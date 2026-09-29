package com.gfmaster.upload.storage;

import static org.assertj.core.api.Assertions.assertThat;

import com.gfmaster.config.GfmProperties;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.util.unit.DataSize;
import org.testcontainers.containers.MinIOContainer;
import org.testcontainers.utility.DockerImageName;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

/**
 * Driver S3 chạy với MinIO thật (cùng API với Cloudflare R2 / AWS S3). Không dùng Spring context:
 * dựng driver trực tiếp, để không sinh thêm context và bộ container (bài học Phase 6).
 */
class S3StorageIT {

  static final MinIOContainer MINIO = new MinIOContainer(DockerImageName.parse("minio/minio:latest"));
  static S3Client client;
  static S3Presigner presigner;
  static S3Storage.PublicBucket publicBucket;
  static S3Storage.IncomingBucket incomingBucket;
  static final HttpClient http = HttpClient.newHttpClient();

  @BeforeAll
  static void start() {
    MINIO.start();
    GfmProperties.S3 s3 =
        new GfmProperties.S3(
            MINIO.getS3URL(), "us-east-1", "gfm-public", "gfm-incoming", MINIO.getUserName(), MINIO.getPassword(), true);
    S3Storage.validated(s3);
    client = S3Storage.client(s3);
    presigner = S3Storage.presigner(s3);
    client.createBucket(b -> b.bucket("gfm-public"));
    client.createBucket(b -> b.bucket("gfm-incoming"));
    publicBucket = new S3Storage.PublicBucket(client, "gfm-public");
    incomingBucket = new S3Storage.IncomingBucket(client, presigner, "gfm-incoming");
  }

  @AfterAll
  static void stop() {
    client.close();
    presigner.close();
    MINIO.stop();
  }

  @Test
  void publicBucketStoresAndReturnsStoredForm() {
    String key = "u1/2026/09/" + UUID.randomUUID() + ".webp";
    byte[] bytes = {1, 2, 3, 4};

    assertThat(publicBucket.put(key, bytes, "image/webp")).isEqualTo("/uploads/" + key);
    assertThat(publicBucket.exists(key)).isTrue();
    assertThat(publicBucket.get(key)).containsExactly(bytes);
    assertThat(client.headObject(b -> b.bucket("gfm-public").key(key)).cacheControl()).contains("immutable");

    publicBucket.delete(key);
    assertThat(publicBucket.exists(key)).isFalse();
  }

  @Test
  void browserCanPutExactlyWhatWasSigned() throws Exception {
    String key = "u1/" + UUID.randomUUID();
    byte[] image = new byte[2048];
    URI url = incomingBucket.presignPut(key, "image/png", image.length, Duration.ofMinutes(5)).orElseThrow();
    assertThat(incomingBucket.size(key)).isEmpty();

    // Như trình duyệt: PUT thẳng lên storage, không qua backend, không có Bearer
    HttpResponse<String> ok = put(url, "image/png", image);
    assertThat(ok.statusCode()).isEqualTo(200);
    assertThat(incomingBucket.size(key)).hasValue(image.length);
    assertThat(incomingBucket.get(key)).hasSize(image.length);

    incomingBucket.delete(key);
    assertThat(incomingBucket.size(key)).isEmpty();
  }

  @Test
  void presignedUrlRejectsOtherContentTypeOrSize() throws Exception {
    String key = "u1/" + UUID.randomUUID();
    URI url = incomingBucket.presignPut(key, "image/png", 100, Duration.ofMinutes(5)).orElseThrow();

    assertThat(put(url, "text/html", new byte[100]).statusCode()).isEqualTo(403);
    assertThat(put(url, "image/png", new byte[5000]).statusCode()).isEqualTo(403);
    assertThat(incomingBucket.size(key)).isEmpty();
  }

  @Test
  void incomingObjectsAreNotPubliclyReadable() throws Exception {
    String key = "u1/" + UUID.randomUUID();
    incomingBucket.put(key, new byte[] {9}, "image/png");
    HttpResponse<String> anonymous =
        http.send(
            HttpRequest.newBuilder(URI.create(MINIO.getS3URL() + "/gfm-incoming/" + key)).GET().build(),
            HttpResponse.BodyHandlers.ofString());
    assertThat(anonymous.statusCode()).isEqualTo(403);
  }

  /** Cấu hình Spring khi STORAGE_DRIVER=s3: đúng một bean mỗi loại, thiếu cấu hình thì không khởi động. */
  @Test
  void springWiringForS3Driver() {
    GfmProperties.S3 s3 =
        new GfmProperties.S3(MINIO.getS3URL(), "us-east-1", "gfm-public", "gfm-incoming", "u", "p", true);
    new ApplicationContextRunner()
        .withPropertyValues("gfm.storage.driver=s3")
        .withBean(GfmProperties.class, () -> props(s3))
        .withUserConfiguration(S3Storage.class, LocalIncomingStorage.class)
        .run(
            ctx -> {
              assertThat(ctx).hasSingleBean(StorageDriver.class).hasSingleBean(IncomingStorage.class);
              assertThat(ctx.getBean(IncomingStorage.class)).isInstanceOf(S3Storage.IncomingBucket.class);
            });

    GfmProperties.S3 sameBucket =
        new GfmProperties.S3(MINIO.getS3URL(), "auto", "gfm-public", "gfm-public", "u", "p", true);
    new ApplicationContextRunner()
        .withPropertyValues("gfm.storage.driver=s3")
        .withBean(GfmProperties.class, () -> props(sameBucket))
        .withUserConfiguration(S3Storage.class)
        .run(ctx -> assertThat(ctx).hasFailed().getFailure().hasStackTraceContaining("phải khác S3_BUCKET"));
  }

  private static GfmProperties props(GfmProperties.S3 s3) {
    GfmProperties.Storage storage =
        new GfmProperties.Storage("s3", "u", "i", "https://img.example.com", DataSize.ofMegabytes(12), s3);
    return new GfmProperties(null, null, null, null, null, storage, null, null, null, null);
  }

  private static HttpResponse<String> put(URI url, String contentType, byte[] body) throws Exception {
    return http.send(
        HttpRequest.newBuilder(url).header("Content-Type", contentType).PUT(HttpRequest.BodyPublishers.ofByteArray(body)).build(),
        HttpResponse.BodyHandlers.ofString());
  }
}
