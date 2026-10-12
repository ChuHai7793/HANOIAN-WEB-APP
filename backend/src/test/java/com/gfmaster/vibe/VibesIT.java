package com.gfmaster.vibe;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gfmaster.place.PlaceType;
import com.gfmaster.place.PriceRange;
import com.gfmaster.spot.SpotCategory;
import com.gfmaster.support.ApiTestSupport;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.JsonNode;

/** Nhãn kiểu hẹn: mặc định theo loại, admin sửa, thứ tự ghi đè default &lt; claude &lt; admin; SQL khớp Java. */
class VibesIT extends ApiTestSupport {

  @Autowired JdbcTemplate jdbc;
  private UUID admin;

  @BeforeEach
  void setUp() {
    admin = newUser();
  }

  @Test
  void sqlDefaultsMatchJava() {
    for (PlaceType type : PlaceType.values()) {
      for (PriceRange price : PriceRange.values()) {
        String sql = jdbc.queryForObject("select default_place_vibes(?, ?)", String.class, type.name(), price.name());
        assertThat(sql).as("%s / %s", type, price).isEqualTo(VibeConverters.join(VibeDefaults.forPlace(type, price)));
      }
    }
    for (SpotCategory category : SpotCategory.values()) {
      String sql = jdbc.queryForObject("select default_spot_vibes(?)", String.class, category.name());
      assertThat(sql).as("%s", category).isEqualTo(VibeConverters.join(VibeDefaults.forSpot(category)));
    }
  }

  @Test
  void catalogVibesFollowSourcePriority() throws Exception {
    // Thêm mới: nhãn mặc định theo loại; form gửi kèm đúng nhãn mặc định vẫn là "default"
    JsonNode cafe = body(postAs(admin, "/api/v1/admin/catalog", place("cafe", "medium", "[\"chill\"]", null, null)).andExpect(status().isCreated()));
    assertVibes(cafe, "default", "chill");
    String id = cafe.get("id").asString();

    // Đổi loại khi còn "default": nhãn đổi theo loại mới
    JsonNode bar = body(putJson("/api/v1/admin/catalog/" + id, place("bar", "medium", null, null, 0L)));
    assertVibes(bar, "default", "romantic");

    // Admin chọn nhãn khác: thành "admin"; đổi loại sau đó không làm mất nhãn admin
    JsonNode mine = body(putJson("/api/v1/admin/catalog/" + id, place("bar", "medium", "[\"romantic\",\"active\"]", null, 1L)));
    assertVibes(mine, "admin", "active", "romantic");
    JsonNode stillMine = body(putJson("/api/v1/admin/catalog/" + id, place("restaurant", "cheap", "[\"active\",\"romantic\"]", null, 2L)));
    assertVibes(stillMine, "admin", "active", "romantic");

    // "Để hệ thống tự gán": về mặc định theo loại hiện tại
    JsonNode reset = body(putJson("/api/v1/admin/catalog/" + id, place("restaurant", "cheap", "[\"active\"]", true, 3L)));
    assertVibes(reset, "default", "chill", "romantic");

    // Claude gán (cách A: ghi thẳng DB); form gửi lại đúng nhãn đó thì vẫn là "claude"
    jdbc.update("update place_catalog set vibes = 'active', vibes_source = 'claude' where id = ?::uuid", id);
    JsonNode claude = body(putJson("/api/v1/admin/catalog/" + id, place("restaurant", "cheap", "[\"active\"]", null, 4L)));
    assertVibes(claude, "claude", "active");
  }

  @Test
  void spotVibesDefaultAndAdminOverride() throws Exception {
    JsonNode museum = body(postAs(admin, "/api/v1/admin/spots", spot("museum", null)).andExpect(status().isCreated()));
    assertVibes(museum, "default", "chill");

    JsonNode edited = body(putJson("/api/v1/admin/spots/" + museum.get("id").asString(), spot("museum", "[\"romantic\"]", 0L)));
    assertVibes(edited, "admin", "romantic");
  }

  @Test
  void invalidVibeIsRejected() throws Exception {
    postAs(admin, "/api/v1/admin/catalog", place("cafe", "medium", "[\"sleepy\"]", null, null)).andExpect(status().isBadRequest());
  }

  // ---- Helpers ----

  private static void assertVibes(JsonNode item, String source, String... vibes) {
    List<String> actual = new ArrayList<>();
    item.get("vibes").forEach(v -> actual.add(v.asString()));
    assertThat(actual).containsExactly(vibes);
    assertThat(item.get("vibesSource").asString()).isEqualTo(source);
  }

  private org.springframework.test.web.servlet.ResultActions putJson(String path, String json) throws Exception {
    return mvc.perform(
            put(path).header(HttpHeaders.AUTHORIZATION, bearer(admin)).contentType(MediaType.APPLICATION_JSON).content(json))
        .andExpect(status().isOk());
  }

  private static String place(String type, String price, String vibes, Boolean auto, Long version) {
    return """
        {"type": "%s", "district": "HOAN_KIEM", "name": "Quán thử vibe", "priceRange": "%s", "rating": 4,
         "openTime": "08:00", "closeTime": "22:00", "vibes": %s, "vibesAuto": %s, "version": %s}
        """
        .formatted(type, price, vibes, auto, version);
  }

  private static String spot(String category, String vibes) {
    return spot(category, vibes, null);
  }

  private static String spot(String category, String vibes, Long version) {
    return """
        {"category": "%s", "district": "BA_DINH", "name": "Chỗ thử vibe", "priceFrom": 0, "indoor": true,
         "vibes": %s, "version": %s}
        """
        .formatted(category, vibes, version);
  }
}
