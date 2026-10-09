package com.gfmaster.profile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gfmaster.support.ApiTestSupport;
import java.time.Duration;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.JsonNode;

/**
 * Hồ sơ cá nhân: guest (tài khoản tự đăng ký) sửa được hồ sơ và ảnh đại diện của chính mình, dù mọi
 * request ghi dữ liệu khác của guest bị chặn; admin xem được hồ sơ của mọi người.
 */
class ProfileIT extends ApiTestSupport {

  private static final Duration WAIT = Duration.ofSeconds(20);

  @Autowired JdbcTemplate jdbc;

  @Test
  void guestSavesOwnProfileWithAvatarAndAdminSeesIt() throws Exception {
    UUID admin = newUser();
    UUID guest = newGuestOf(admin);

    // Chưa có hồ sơ: version null, tên lấy từ lúc đăng ký
    getAs(guest, "/api/v1/me/profile")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.displayName").value("Guest"))
        .andExpect(jsonPath("$.version").doesNotExist());

    // Guest tự upload ảnh đại diện: upload thuộc về guest, không phải admin
    String uploadId = uploadAvatar(guest);
    String avatarUrl = body(getAs(guest, "/api/v1/uploads/" + uploadId)).get("url").asString();
    assertThat(jdbc.queryForObject("select user_id from uploads where id = ?::uuid", String.class, uploadId))
        .isEqualTo(guest.toString());

    JsonNode saved =
        body(
            putAs(guest, profileJson("Lan", avatarUrl, "2000-01-02", "0912345678", null))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Lan"))
                .andExpect(jsonPath("$.avatarUrl").value(avatarUrl))
                .andExpect(jsonPath("$.gender").value("female"))
                .andExpect(jsonPath("$.city").value("Hà Nội"))
                .andExpect(jsonPath("$.version").value(0)));
    assertThat(saved.get("completedAt").isNull()).isFalse();

    // Tên và ảnh đi kèm thông tin đăng nhập (thanh menu dùng)
    getAs(guest, "/api/v1/auth/me")
        .andExpect(jsonPath("$.displayName").value("Lan"))
        .andExpect(jsonPath("$.avatarUrl").value(avatarUrl));

    // Gửi version cũ (null) sau khi đã có hồ sơ: 409, kèm bản hiện tại
    putAs(guest, profileJson("Lan 2", avatarUrl, "2000-01-02", "0912345678", null))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("VERSION_CONFLICT"))
        .andExpect(jsonPath("$.current.version").value(0));
    putAs(guest, profileJson("Lan 2", avatarUrl, "2000-01-02", "", 0L))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.phone").doesNotExist())
        .andExpect(jsonPath("$.version").value(1));

    // Danh sách người dùng: chỉ admin
    getAs(guest, "/api/v1/admin/users").andExpect(status().isForbidden());
    JsonNode list = body(getAs(admin, "/api/v1/admin/users").andExpect(status().isOk()));
    JsonNode row = null;
    for (JsonNode u : list) if (u.get("id").asString().equals(guest.toString())) row = u;
    assertThat(row).isNotNull();
    assertThat(row.get("role").asString()).isEqualTo("GUEST");
    assertThat(row.get("profile").get("displayName").asString()).isEqualTo("Lan 2");
    assertThat(row.get("profile").get("city").asString()).isEqualTo("Hà Nội");
  }

  @Test
  void invalidProfileIsRejected() throws Exception {
    UUID user = newUser();
    putAs(user, profileJson("", null, null, null, null)).andExpect(status().isBadRequest());
    putAs(user, profileJson("A", null, null, "abc", null)).andExpect(status().isBadRequest());
    putAs(user, profileJson("A", null, LocalDate.now().plusDays(1).toString(), null, null))
        .andExpect(status().isBadRequest());
    putAs(user, profileJson("A", "javascript:alert(1)", null, null, null)).andExpect(status().isBadRequest());
    getAs(user, "/api/v1/me/profile").andExpect(jsonPath("$.version").doesNotExist());
  }

  // ---- Helpers ----

  private ResultActions putAs(UUID user, String body) throws Exception {
    return mvc.perform(
        put("/api/v1/me/profile")
            .header(HttpHeaders.AUTHORIZATION, bearer(user))
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
  }

  private String profileJson(String name, String avatar, String birthday, String phone, Long version) {
    return """
        {"displayName": %s, "avatarUrl": %s, "birthday": %s, "gender": "female",
         "phone": %s, "city": "Hà Nội", "bio": "Xin chào", "version": %s}
        """
        .formatted(q(name), q(avatar), q(birthday), q(phone), version);
  }

  private static String q(String s) {
    return s == null ? "null" : "\"" + s + "\"";
  }

  /** Luồng upload thẳng của trình duyệt (driver local): begin → PUT nội dung → complete → READY. */
  private String uploadAvatar(UUID user) throws Exception {
    byte[] raw = png(300, 300);
    JsonNode begin =
        body(
            postAs(user, "/api/v1/uploads/direct", "{\"contentType\": \"image/png\", \"sizeBytes\": %d}".formatted(raw.length))
                .andExpect(status().isCreated()));
    String id = begin.get("id").asString();
    mvc.perform(
            put(begin.get("uploadUrl").asString())
                .header(HttpHeaders.AUTHORIZATION, bearer(user))
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .content(raw))
        .andExpect(status().isNoContent());
    postAs(user, "/api/v1/uploads/" + id + "/complete", "").andExpect(status().isAccepted());
    await()
        .atMost(WAIT)
        .until(() -> "READY".equals(body(getAs(user, "/api/v1/uploads/" + id)).get("status").asString()));
    return id;
  }
}
