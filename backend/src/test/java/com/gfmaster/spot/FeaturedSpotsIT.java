package com.gfmaster.spot;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gfmaster.support.ApiTestSupport;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.ResultActions;

/** Chỗ chơi nổi bật + ảnh nền banner Tìm chỗ chơi: admin chọn / đổi, ai cũng xem được. */
class FeaturedSpotsIT extends ApiTestSupport {

  @Autowired JdbcTemplate jdbc;

  @BeforeEach
  void clean() {
    jdbc.update("delete from featured_spots");
    jdbc.update("delete from app_settings where key in ('spots.banner', 'explore.banner')");
  }

  private String spot(UUID admin, String name) throws Exception {
    return body(postAs(admin, "/api/v1/admin/spots", """
        {"category": "museum", "district": "HOAN_KIEM", "name": "%s", "priceFrom": 30000, "indoor": true}
        """.formatted(name)).andExpect(status().isCreated())).get("id").asString();
  }

  private ResultActions putJson(UUID user, String path, String json) throws Exception {
    return mvc.perform(
        put(path).header(HttpHeaders.AUTHORIZATION, bearer(user)).contentType(MediaType.APPLICATION_JSON).content(json));
  }

  @Test
  void adminPicksFeaturedSpotsAndEveryoneSeesThemInOrder() throws Exception {
    UUID admin = newUser();
    String a = spot(admin, "Hỏa Lò " + UUID.randomUUID());
    String b = spot(admin, "Văn Miếu " + UUID.randomUUID());

    putJson(admin, "/api/v1/admin/spots/featured", """
        [{"spotId": "%s", "kicker": "Một chút xưa cũ", "headline": "Dạo Văn Miếu."},
         {"spotId": "%s", "headline": "Nghe chuyện cũ."}]
        """.formatted(b, a))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(2)));

    // Khách chưa đăng nhập xem được, đúng thứ tự admin chọn
    mvc.perform(get("/api/v1/spots/featured"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].position").value(1))
        .andExpect(jsonPath("$[0].spot.id").value(b))
        .andExpect(jsonPath("$[0].kicker").value("Một chút xưa cũ"))
        .andExpect(jsonPath("$[1].spot.id").value(a))
        .andExpect(jsonPath("$[1].kicker").value(""));

    // Người đã lưu thấy "đã lưu" trên thẻ nổi bật
    UUID user = newUser();
    postAs(user, "/api/v1/spots/" + b + "/my-place", "").andExpect(status().isCreated());
    getAs(user, "/api/v1/spots/featured").andExpect(jsonPath("$[0].spot.inMyPlace").value(true));

    // Xoá chỗ chơi thì mất khỏi danh sách nổi bật
    deleteAs(admin, "/api/v1/admin/spots/" + b).andExpect(status().isNoContent());
    mvc.perform(get("/api/v1/spots/featured")).andExpect(jsonPath("$", hasSize(1)));

    putJson(admin, "/api/v1/admin/spots/featured", "[]").andExpect(status().isOk());
    mvc.perform(get("/api/v1/spots/featured")).andExpect(jsonPath("$", hasSize(0)));
  }

  @Test
  void featuredValidation() throws Exception {
    UUID admin = newUser();
    String a = spot(admin, "S " + UUID.randomUUID());
    String item = "{\"spotId\": \"%s\", \"headline\": \"Câu dẫn\"}".formatted(a);
    putJson(newGuestOf(admin), "/api/v1/admin/spots/featured", "[" + item + "]").andExpect(status().isForbidden());
    putJson(admin, "/api/v1/admin/spots/featured", "[" + item + "," + item + "]").andExpect(status().isBadRequest());
    // Câu dẫn không bắt buộc (thẻ lấy tên + địa chỉ làm chính)
    putJson(admin, "/api/v1/admin/spots/featured", "[{\"spotId\": \"%s\", \"headline\": \"\"}]".formatted(a)).andExpect(status().isOk());
    putJson(admin, "/api/v1/admin/spots/featured", "[{\"spotId\": \"%s\"}]".formatted(a)).andExpect(status().isOk());
    String[] seven = new String[11];
    for (int i = 0; i < 11; i++) seven[i] = "{\"spotId\": \"%s\", \"headline\": \"x\"}".formatted(spot(admin, "P" + i + UUID.randomUUID()));
    putJson(admin, "/api/v1/admin/spots/featured", "[" + String.join(",", java.util.Arrays.copyOf(seven, 10)) + "]").andExpect(status().isOk());
    putJson(admin, "/api/v1/admin/spots/featured", "[" + String.join(",", seven) + "]").andExpect(status().isBadRequest());
    putJson(admin, "/api/v1/admin/spots/featured", "[{\"spotId\": \"%s\", \"headline\": \"x\"}]".formatted(UUID.randomUUID()))
        .andExpect(status().isNotFound());
  }

  @Test
  void bannerIsPublicAndOnlyAdminChangesIt() throws Exception {
    UUID admin = newUser();
    mvc.perform(get("/api/v1/spots/banner")).andExpect(status().isOk()).andExpect(jsonPath("$.imageUrl").value(nullValue()));

    putJson(newGuestOf(admin), "/api/v1/admin/spots/banner", "{\"imageUrl\": \"https://example.com/a.webp\"}")
        .andExpect(status().isForbidden());
    putJson(admin, "/api/v1/admin/spots/banner", "{\"imageUrl\": \"javascript:alert(1)\"}").andExpect(status().isBadRequest());
    putJson(admin, "/api/v1/admin/spots/banner", "{\"imageUrl\": \"https://example.com/a.webp\"}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.imageUrl").value("https://example.com/a.webp"));
    mvc.perform(get("/api/v1/spots/banner")).andExpect(jsonPath("$.imageUrl").value("https://example.com/a.webp"));
    // Banner Khám phá quán là khoá riêng, không bị đổi theo
    mvc.perform(get("/api/v1/catalog/banner")).andExpect(jsonPath("$.imageUrl").value(nullValue()));

    putJson(admin, "/api/v1/admin/spots/banner", "{\"imageUrl\": null}").andExpect(status().isOk());
    mvc.perform(get("/api/v1/spots/banner")).andExpect(jsonPath("$.imageUrl").value(nullValue()));
  }
}
