package com.gfmaster.upload;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gfmaster.support.ApiTestSupport;
import com.gfmaster.upload.storage.IncomingStorage;
import com.sksamuel.scrimage.ImmutableImage;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.JsonNode;

/**
 * Upload thẳng với driver local (mặc định của dev và test): cùng các bước như S3, chỉ khác bước PUT
 * đi vào {@code /api/v1/uploads/{id}/content} thay cho presigned URL.
 */
class DirectUploadIT extends ApiTestSupport {

  private static final Duration WAIT = Duration.ofSeconds(20);

  @Autowired JdbcTemplate jdbc;
  @Autowired IncomingStorage incoming;

  @Test
  void browserUploadsRawImageThenWorkerPublishesProcessedOne() throws Exception {
    UUID user = newUser();
    byte[] raw = png(2000, 1000);

    JsonNode begin = body(begin(user, "image/png", raw.length).andExpect(status().isCreated()));
    String id = begin.get("id").asString();
    String uploadUrl = begin.get("uploadUrl").asString();
    assertThat(uploadUrl).isEqualTo("/api/v1/uploads/" + id + "/content");
    assertThat(begin.get("method").asString()).isEqualTo("PUT");
    assertThat(begin.get("headers").get("Content-Type").asString()).isEqualTo("image/png");
    getAs(user, "/api/v1/uploads/" + id).andExpect(jsonPath("$.status").value("AWAITING_UPLOAD"));

    putContent(user, uploadUrl, raw).andExpect(status().isNoContent());
    String incomingKey = jdbc.queryForObject("select incoming_key from uploads where id = ?", String.class, id);
    assertThat(incoming.size(incomingKey)).hasValue(raw.length);

    postAs(user, "/api/v1/uploads/" + id + "/complete", "").andExpect(status().isAccepted());

    JsonNode done = awaitFinished(user, id);
    assertThat(done.get("status").asString()).isEqualTo("READY");
    assertThat(done.get("width").asInt()).isEqualTo(1200);
    assertThat(done.get("height").asInt()).isEqualTo(600);
    String url = done.get("url").asString();
    assertThat(url).startsWith("/uploads/" + user + "/").endsWith(".webp");
    assertThat(done.get("thumbUrl").asString()).isEqualTo(url.replace(".webp", "-320.webp"));

    byte[] served = mvc.perform(get(url)).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
    assertThat(ImmutableImage.loader().fromBytes(served).width).isEqualTo(1200);
    // Ảnh gốc (có thể còn GPS) bị xoá khỏi vùng incoming sau khi xử lý
    await().atMost(WAIT).until(() -> incoming.size(incomingKey).isEmpty());
    // Ảnh vừa upload dùng được ngay cho quán
    postAs(
            user,
            "/api/v1/places",
            """
            {"type": "cafe", "name": "Có ảnh", "priceRange": "cheap", "rating": 3,
             "openTime": "07:00", "closeTime": "21:00", "imageUrl": "%s"}
            """
                .formatted(url))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.imageUrl").value(url));
  }

  @Test
  void fakeImageEndsAsFailedAndIsDeleted() throws Exception {
    UUID user = newUser();
    byte[] notAnImage = "<script>alert(1)</script>".getBytes();
    String id = body(begin(user, "image/jpeg", notAnImage.length)).get("id").asString();
    putContent(user, "/api/v1/uploads/" + id + "/content", notAnImage).andExpect(status().isNoContent());
    String incomingKey = jdbc.queryForObject("select incoming_key from uploads where id = ?", String.class, id);

    postAs(user, "/api/v1/uploads/" + id + "/complete", "").andExpect(status().isAccepted());

    assertThat(awaitFinished(user, id).get("status").asString()).isEqualTo("FAILED");
    await().atMost(WAIT).until(() -> incoming.size(incomingKey).isEmpty());
  }

  @Test
  void validatesTypeSizeAndOrder() throws Exception {
    UUID user = newUser();
    begin(user, "image/gif", 100)
        .andExpect(status().isUnsupportedMediaType())
        .andExpect(jsonPath("$.code").value("UNSUPPORTED_IMAGE"));
    begin(user, "image/png", 13L * 1024 * 1024)
        .andExpect(status().isContentTooLarge())
        .andExpect(jsonPath("$.code").value("FILE_TOO_LARGE"));

    String id = body(begin(user, "image/png", 100)).get("id").asString();
    // Báo xong khi storage chưa nhận được gì
    postAs(user, "/api/v1/uploads/" + id + "/complete", "")
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("UPLOAD_NOT_RECEIVED"));
    // File thật lớn hơn giới hạn dù đã khai nhỏ
    putContent(user, "/api/v1/uploads/" + id + "/content", new byte[12 * 1024 * 1024 + 1])
        .andExpect(status().isContentTooLarge());
  }

  @Test
  void uploadsAreScopedToOwner() throws Exception {
    UUID owner = newUser();
    String id = body(begin(owner, "image/png", 100)).get("id").asString();
    UUID other = newUser();
    getAs(other, "/api/v1/uploads/" + id).andExpect(status().isNotFound());
    putContent(other, "/api/v1/uploads/" + id + "/content", png(10, 10)).andExpect(status().isNotFound());
    postAs(other, "/api/v1/uploads/" + id + "/complete", "").andExpect(status().isNotFound());
    // Guest (chỉ xem) không bắt đầu upload được
    begin(newGuestOf(owner), "image/png", 100).andExpect(status().isForbidden());
  }

  @Test
  void unfinishedDirectUploadsAreCleanedUp(@Autowired OrphanUploadCleanupJob job) throws Exception {
    UUID user = newUser();
    String id = body(begin(user, "image/png", 100)).get("id").asString();
    putContent(user, "/api/v1/uploads/" + id + "/content", png(10, 10));
    String incomingKey = jdbc.queryForObject("select incoming_key from uploads where id = ?", String.class, id);

    // Người dùng đóng tab, không bao giờ gọi complete: quá 1 ngày thì bị dọn
    job.cleanUnfinished(Instant.now().plusSeconds(1));

    assertThat(jdbc.queryForObject("select count(*) from uploads where id = ?", Integer.class, id)).isZero();
    assertThat(incoming.size(incomingKey)).isEmpty();
  }

  // ---- Helpers ----

  private ResultActions begin(UUID user, String contentType, long size) throws Exception {
    return postAs(user, "/api/v1/uploads/direct", "{\"contentType\": \"%s\", \"sizeBytes\": %d}".formatted(contentType, size));
  }

  private ResultActions putContent(UUID user, String url, byte[] bytes) throws Exception {
    return mvc.perform(
        put(url)
            .header(HttpHeaders.AUTHORIZATION, bearer(user))
            .contentType(MediaType.APPLICATION_OCTET_STREAM)
            .content(bytes));
  }

  private JsonNode awaitFinished(UUID user, String id) {
    JsonNode[] last = new JsonNode[1];
    await()
        .atMost(WAIT)
        .until(
            () -> {
              last[0] = body(getAs(user, "/api/v1/uploads/" + id));
              String s = last[0].get("status").asString();
              return s.equals("READY") || s.equals("FAILED");
            });
    return last[0];
  }
}
