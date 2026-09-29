package com.gfmaster.upload.storage;

import com.gfmaster.config.GfmProperties;
import java.net.URI;
import java.time.Duration;
import java.util.Optional;
import java.util.OptionalLong;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

/**
 * Storage S3-compatible (Cloudflare R2, AWS S3, MinIO), bật khi {@code gfm.storage.driver=s3}.
 *
 * <ul>
 *   <li>{@code bucket}: ảnh đã xử lý, đọc công khai qua CDN ({@code public-base-url}).
 *   <li>{@code incoming-bucket}: ảnh gốc trình duyệt PUT thẳng lên bằng presigned URL. Để riêng tư,
 *       nên đặt lifecycle rule xoá object quá 1 ngày.
 * </ul>
 */
@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(name = "gfm.storage.driver", havingValue = "s3")
public class S3Storage {

  @Bean(destroyMethod = "close")
  S3Client s3Client(GfmProperties props) {
    return client(validated(props.storage().s3()));
  }

  @Bean(destroyMethod = "close")
  S3Presigner s3Presigner(GfmProperties props) {
    return presigner(validated(props.storage().s3()));
  }

  @Bean
  StorageDriver s3PublicStorage(S3Client client, GfmProperties props) {
    return new PublicBucket(client, props.storage().s3().bucket());
  }

  @Bean
  IncomingStorage s3IncomingStorage(S3Client client, S3Presigner presigner, GfmProperties props) {
    return new IncomingBucket(client, presigner, props.storage().s3().incomingBucket());
  }

  /** Thiếu cấu hình thì app không khởi động, thay vì lỗi lúc người dùng upload. */
  static GfmProperties.S3 validated(GfmProperties.S3 s3) {
    if (s3 == null
        || blank(s3.endpoint())
        || blank(s3.bucket())
        || blank(s3.incomingBucket())
        || blank(s3.accessKey())
        || blank(s3.secretKey())) {
      throw new IllegalStateException(
          "gfm.storage.driver=s3 cần S3_ENDPOINT, S3_BUCKET, S3_INCOMING_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY");
    }
    if (s3.bucket().equals(s3.incomingBucket())) {
      throw new IllegalStateException("S3_INCOMING_BUCKET phải khác S3_BUCKET (bucket incoming là riêng tư)");
    }
    return s3;
  }

  public static S3Client client(GfmProperties.S3 s3) {
    return S3Client.builder()
        .endpointOverride(URI.create(s3.endpoint()))
        .region(Region.of(blank(s3.region()) ? "auto" : s3.region()))
        .credentialsProvider(credentials(s3))
        .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(s3.pathStyle()).build())
        .build();
  }

  public static S3Presigner presigner(GfmProperties.S3 s3) {
    return S3Presigner.builder()
        .endpointOverride(URI.create(s3.endpoint()))
        .region(Region.of(blank(s3.region()) ? "auto" : s3.region()))
        .credentialsProvider(credentials(s3))
        .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(s3.pathStyle()).build())
        .build();
  }

  private static StaticCredentialsProvider credentials(GfmProperties.S3 s3) {
    return StaticCredentialsProvider.create(AwsBasicCredentials.create(s3.accessKey(), s3.secretKey()));
  }

  private static boolean blank(String s) {
    return s == null || s.isBlank();
  }

  /** Ảnh đã xử lý. Trả về dạng lưu DB {@code /uploads/<key>}; URL thật do ImageUrls ghép với CDN. */
  public static class PublicBucket implements StorageDriver {

    private final S3Client client;
    private final String bucket;

    public PublicBucket(S3Client client, String bucket) {
      this.client = client;
      this.bucket = bucket;
    }

    @Override
    public String put(String key, byte[] content, String contentType) {
      client.putObject(
          b ->
              b.bucket(bucket)
                  .key(key)
                  .contentType(contentType)
                  // Tên file là UUID, nội dung không bao giờ đổi: CDN và trình duyệt cache 1 năm
                  .cacheControl("public, max-age=31536000, immutable"),
          RequestBody.fromBytes(content));
      return ImageUrls.stored(key);
    }

    @Override
    public byte[] get(String key) {
      return client.getObjectAsBytes(b -> b.bucket(bucket).key(key)).asByteArray();
    }

    @Override
    public void delete(String key) {
      client.deleteObject(b -> b.bucket(bucket).key(key));
    }

    @Override
    public boolean exists(String key) {
      return sizeOf(client, bucket, key).isPresent();
    }
  }

  /** Ảnh gốc chờ xử lý: trình duyệt PUT thẳng bằng presigned URL. */
  public static class IncomingBucket implements IncomingStorage {

    private final S3Client client;
    private final S3Presigner presigner;
    private final String bucket;

    public IncomingBucket(S3Client client, S3Presigner presigner, String bucket) {
      this.client = client;
      this.presigner = presigner;
      this.bucket = bucket;
    }

    @Override
    public Optional<URI> presignPut(String key, String contentType, long contentLength, Duration ttl) {
      // Content-Type và Content-Length nằm trong chữ ký: gửi khác đi thì storage từ chối (403)
      var request =
          presigner.presignPutObject(
              p ->
                  p.signatureDuration(ttl)
                      .putObjectRequest(
                          o -> o.bucket(bucket).key(key).contentType(contentType).contentLength(contentLength)));
      return Optional.of(URI.create(request.url().toString()));
    }

    @Override
    public void put(String key, byte[] content, String contentType) {
      client.putObject(b -> b.bucket(bucket).key(key).contentType(contentType), RequestBody.fromBytes(content));
    }

    @Override
    public byte[] get(String key) {
      return client.getObjectAsBytes(b -> b.bucket(bucket).key(key)).asByteArray();
    }

    @Override
    public OptionalLong size(String key) {
      return sizeOf(client, bucket, key);
    }

    @Override
    public void delete(String key) {
      client.deleteObject(b -> b.bucket(bucket).key(key));
    }
  }

  static OptionalLong sizeOf(S3Client client, String bucket, String key) {
    try {
      return OptionalLong.of(client.headObject(b -> b.bucket(bucket).key(key)).contentLength());
    } catch (NoSuchKeyException e) {
      return OptionalLong.empty();
    } catch (S3Exception e) {
      if (e.statusCode() == 404) return OptionalLong.empty();
      throw e;
    }
  }
}
