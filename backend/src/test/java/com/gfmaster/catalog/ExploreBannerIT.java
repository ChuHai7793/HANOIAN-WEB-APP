package com.gfmaster.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gfmaster.support.ApiTestSupport;
import com.gfmaster.upload.UploadRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.ResultActions;

/** Ảnh nền banner Khám phá quán: admin đổi được, ai cũng xem; ảnh đang làm nền không bị job dọn ảnh xoá. */
class ExploreBannerIT extends ApiTestSupport {

  @Autowired JdbcTemplate jdbc;
  @Autowired UploadRepository uploads;

  @BeforeEach
  void clean() {
    jdbc.update("delete from app_settings");
  }

  private ResultActions setBanner(UUID user, String json) throws Exception {
    return mvc.perform(
        put("/api/v1/admin/catalog/banner")
            .header(HttpHeaders.AUTHORIZATION, bearer(user))
            .contentType(MediaType.APPLICATION_JSON)
            .content(json));
  }

  @Test
  void adminChangesBannerAndCanResetToDefault() throws Exception {
    UUID admin = newUser();
    // Chưa đặt: dùng ảnh mặc định của frontend
    mvc.perform(get("/api/v1/catalog/banner")).andExpect(status().isOk()).andExpect(jsonPath("$.imageUrl").doesNotExist());

    String url =
        body(
                mvc.perform(
                        multipart("/api/v1/uploads/image")
                            .file(new MockMultipartFile("file", "ho-guom.png", "image/png", png(1600, 900)))
                            .param("purpose", "banner")
                            .param("name", "Hồ Gươm đêm")
                            .header(HttpHeaders.AUTHORIZATION, bearer(admin)))
                    .andExpect(status().isCreated()))
            .get("url")
            .asString();
    assertThat(url).contains("/banners/").contains("ho-guom-dem-");

    setBanner(admin, "{\"imageUrl\": \"%s\"}".formatted(url)).andExpect(status().isOk()).andExpect(jsonPath("$.imageUrl").value(url));
    mvc.perform(get("/api/v1/catalog/banner")).andExpect(jsonPath("$.imageUrl").value(url));

    // Job dọn ảnh mồ côi không đụng tới ảnh đang làm nền
    assertThat(uploads.findOrphans(Instant.now().plus(Duration.ofDays(30)), 100))
        .noneMatch(u -> url.equals(u.getUrl()));

    // Quay về ảnh mặc định
    setBanner(admin, "{\"imageUrl\": null}").andExpect(status().isOk()).andExpect(jsonPath("$.imageUrl").doesNotExist());
    mvc.perform(get("/api/v1/catalog/banner")).andExpect(jsonPath("$.imageUrl").doesNotExist());
  }

  @Test
  void onlyAdminsAndOnlyImageUrls() throws Exception {
    UUID admin = newUser();
    setBanner(newGuestOf(admin), "{\"imageUrl\": \"https://example.com/a.webp\"}").andExpect(status().isForbidden());
    setBanner(admin, "{\"imageUrl\": \"javascript:alert(1)\"}").andExpect(status().isBadRequest());
  }
}
