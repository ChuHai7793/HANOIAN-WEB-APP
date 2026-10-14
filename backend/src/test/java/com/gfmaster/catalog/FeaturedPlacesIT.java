package com.gfmaster.catalog;

import static org.hamcrest.Matchers.hasSize;
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

/** Điểm hẹn nổi bật: admin chọn tối đa 6 quán kèm câu dẫn; ai cũng xem được. */
class FeaturedPlacesIT extends ApiTestSupport {

  @Autowired JdbcTemplate jdbc;

  @BeforeEach
  void clean() {
    jdbc.update("delete from featured_places");
  }

  private String place(UUID admin, String name) throws Exception {
    return body(postAs(admin, "/api/v1/admin/catalog", """
        {"type": "cafe", "district": "BA_DINH", "name": "%s", "priceRange": "medium",
         "rating": 5, "openTime": "07:00", "closeTime": "22:00"}
        """.formatted(name)).andExpect(status().isCreated())).get("id").asString();
  }

  private ResultActions setFeatured(UUID user, String json) throws Exception {
    return mvc.perform(
        put("/api/v1/admin/catalog/featured")
            .header(HttpHeaders.AUTHORIZATION, bearer(user))
            .contentType(MediaType.APPLICATION_JSON)
            .content(json));
  }

  @Test
  void adminPicksUpToThreeAndEveryoneSeesThemInOrder() throws Exception {
    UUID admin = newUser();
    String a = place(admin, "Rooftop " + UUID.randomUUID());
    String b = place(admin, "Nhà Của Mậu " + UUID.randomUUID());

    setFeatured(admin, """
        [{"catalogId": "%s", "kicker": "Một chút bình yên", "headline": "Chậm lại, bên một tách cà phê."},
         {"catalogId": "%s", "kicker": "Điểm hẹn nổi bật", "headline": "Hẹn nhau ở phía hoàng hôn."}]
        """.formatted(b, a))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(2)));

    // Khách chưa đăng nhập xem được, đúng thứ tự admin chọn
    mvc.perform(get("/api/v1/catalog/featured"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].position").value(1))
        .andExpect(jsonPath("$[0].place.id").value(b))
        .andExpect(jsonPath("$[0].headline").value("Chậm lại, bên một tách cà phê."))
        .andExpect(jsonPath("$[1].place.id").value(a));

    // Xoá quán thì mất khỏi danh sách nổi bật
    deleteAs(admin, "/api/v1/admin/catalog/" + b).andExpect(status().isNoContent());
    mvc.perform(get("/api/v1/catalog/featured")).andExpect(jsonPath("$", hasSize(1)));

    // Danh sách rỗng = tắt khối nổi bật
    setFeatured(admin, "[]").andExpect(status().isOk());
    mvc.perform(get("/api/v1/catalog/featured")).andExpect(jsonPath("$", hasSize(0)));
  }

  @Test
  void validation() throws Exception {
    UUID admin = newUser();
    String a = place(admin, "Q " + UUID.randomUUID());
    String item = "{\"catalogId\": \"%s\", \"headline\": \"Câu dẫn\"}".formatted(a);
    setFeatured(newGuestOf(admin), "[" + item + "]").andExpect(status().isForbidden());
    setFeatured(admin, "[" + item + "," + item + "]").andExpect(status().isBadRequest());
    setFeatured(admin, "[{\"catalogId\": \"%s\", \"headline\": \"\"}]".formatted(a)).andExpect(status().isBadRequest());
    // Tối đa 6
    String[] seven = new String[7];
    for (int i = 0; i < 7; i++) seven[i] = "{\"catalogId\": \"%s\", \"headline\": \"x\"}".formatted(place(admin, "P" + i + UUID.randomUUID()));
    setFeatured(admin, "[" + String.join(",", java.util.Arrays.copyOf(seven, 6)) + "]").andExpect(status().isOk());
    setFeatured(admin, "[" + String.join(",", seven) + "]").andExpect(status().isBadRequest());
    setFeatured(admin, "[{\"catalogId\": \"%s\", \"headline\": \"x\"}]".formatted(UUID.randomUUID())).andExpect(status().isNotFound());
  }
}
