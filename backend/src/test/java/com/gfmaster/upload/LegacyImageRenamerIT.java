package com.gfmaster.upload;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gfmaster.support.ApiTestSupport;
import com.gfmaster.upload.storage.StorageDriver;
import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import tools.jackson.databind.JsonNode;

/** Đổi tên ảnh cũ (<id người dùng>/…/<uuid>.webp) sang tên dễ đọc theo chỗ đang dùng ảnh. */
class LegacyImageRenamerIT extends ApiTestSupport {

  @Autowired JdbcTemplate jdbc;
  @Autowired StorageDriver storage;

  /** Ảnh upload bình thường rồi đổi về tên kiểu cũ (giả lập ảnh có từ trước khi đổi cách đặt tên). */
  private String legacyImage(UUID user) throws Exception {
    JsonNode up =
        body(
            mvc.perform(
                    multipart("/api/v1/uploads/image")
                        .file(new MockMultipartFile("file", "a.png", "image/png", png(400, 300)))
                        .header(HttpHeaders.AUTHORIZATION, bearer(user)))
                .andExpect(status().isCreated()));
    String id = up.get("id").asString();
    String key = jdbc.queryForObject("select storage_key from uploads where id = ?::uuid", String.class, id);
    String legacyKey = "%s/2026/09/%s.webp".formatted(user, UUID.randomUUID());
    String legacyUrl = storage.put(legacyKey, storage.get(key), "image/webp");
    jdbc.update(
        "update uploads set storage_key = ?, url = ?, thumb_url = null, purpose = null, name_hint = null where id = ?::uuid",
        legacyKey, legacyUrl, id);
    return legacyUrl;
  }

  @Test
  void renamesUsedImagesAndUpdatesEveryReference() throws Exception {
    UUID admin = newUser();
    String url = legacyImage(admin);
    String unused = legacyImage(admin);
    String place = createPlace(admin, "cafe", "Cà Phê Đinh").get("id").asString();
    jdbc.update("update places set image_url = ? where id = ?::uuid", url, place);

    // Chạy thử: chỉ liệt kê, không đổi gì
    JsonNode dry = body(postAs(admin, "/api/v1/admin/uploads/rename-legacy?dryRun=true", ""));
    assertThat(dry.get("dryRun").asBoolean()).isTrue();
    assertThat(dry.get("items").toString()).contains("places/").contains("ca-phe-dinh-");
    assertThat(jdbc.queryForObject("select image_url from places where id = ?::uuid", String.class, place)).isEqualTo(url);

    // Chạy thật
    JsonNode res = body(postAs(admin, "/api/v1/admin/uploads/rename-legacy?dryRun=false", ""));
    assertThat(res.get("renamed").asInt()).isGreaterThanOrEqualTo(1);
    String newUrl = jdbc.queryForObject("select image_url from places where id = ?::uuid", String.class, place);
    assertThat(newUrl).matches("/uploads/places/\\d{4}/\\d{2}/ca-phe-dinh-[a-z0-9]{8}\\.webp");
    String newKey = newUrl.substring("/uploads/".length());
    assertThat(storage.exists(newKey)).isTrue();
    assertThat(jdbc.queryForObject("select count(*) from uploads where url = ?", Integer.class, newUrl)).isEqualTo(1);
    // File cũ xoá sau commit; ảnh không ai dùng thì để nguyên cho job dọn ảnh mồ côi
    String oldKey = url.substring("/uploads/".length());
    await().atMost(Duration.ofSeconds(20)).until(() -> !storage.exists(oldKey));
    assertThat(storage.exists(unused.substring("/uploads/".length()))).isTrue();

    // Chạy lại: không còn gì để đổi với ảnh này
    JsonNode again = body(postAs(admin, "/api/v1/admin/uploads/rename-legacy?dryRun=false", ""));
    assertThat(again.get("items").toString()).doesNotContain("ca-phe-dinh-");
  }

  @Test
  void onlyAdmins() throws Exception {
    UUID admin = newUser();
    postAs(newGuestOf(admin), "/api/v1/admin/uploads/rename-legacy", "").andExpect(status().isForbidden());
  }
}
