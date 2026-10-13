package com.gfmaster.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gfmaster.support.ApiTestSupport;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.JsonNode;

/** Nhiều ảnh (tối đa 6) cho quán và chỗ chơi; ảnh đầu là ảnh bìa; My place hiện ảnh của quán gốc. */
class VenuePhotosIT extends ApiTestSupport {

  private static final String A = "https://img.test/a.jpg";
  private static final String B = "https://img.test/b.jpg";
  private static final String C = "https://img.test/c.jpg";
  private UUID admin;

  @BeforeEach
  void setUp() {
    admin = newUser();
  }

  @Test
  void catalogPhotosKeepOrderAndCover() throws Exception {
    JsonNode created = body(postAs(admin, "/api/v1/admin/catalog", place("[\"%s\", \"%s\", \"%s\", \"%s\"]".formatted(A, B, A, C), null, null)).andExpect(status().isCreated()));
    // Bỏ trùng, giữ thứ tự; ảnh đầu là ảnh bìa
    assertThat(urls(created)).containsExactly(A, B, C);
    assertThat(created.get("imageUrl").asString()).isEqualTo(A);
    String id = created.get("id").asString();

    // Đổi thứ tự, bỏ một ảnh → ảnh bìa đổi theo
    JsonNode edited = body(putJson("/api/v1/admin/catalog/" + id, place("[\"%s\", \"%s\"]".formatted(C, A), null, 0L)));
    assertThat(urls(edited)).containsExactly(C, A);
    assertThat(edited.get("imageUrl").asString()).isEqualTo(C);

    // My place của người lưu quán hiện đủ ảnh của quán gốc
    UUID guest = newGuestOf(admin);
    postAs(guest, "/api/v1/catalog/" + id + "/my-place", "").andExpect(status().isCreated());
    JsonNode mine = body(getAs(guest, "/api/v1/places"));
    assertThat(urls(mine.get(0))).containsExactly(C, A);

    // Quá 6 ảnh → 400; client cũ chỉ gửi imageUrl → một ảnh
    String seven = "[" + String.join(",", List.of("1", "2", "3", "4", "5", "6", "7").stream().map(n -> "\"https://img.test/" + n + ".jpg\"").toList()) + "]";
    postAs(admin, "/api/v1/admin/catalog", place(seven, null, null)).andExpect(status().isBadRequest());
    JsonNode legacy = body(postAs(admin, "/api/v1/admin/catalog", place(null, B, null)).andExpect(status().isCreated()));
    assertThat(urls(legacy)).containsExactly(B);
  }

  @Test
  void spotPhotos() throws Exception {
    JsonNode spot = body(postAs(admin, "/api/v1/admin/spots", spot("[\"%s\", \"%s\"]".formatted(B, C), null)).andExpect(status().isCreated()));
    assertThat(urls(spot)).containsExactly(B, C);
    assertThat(spot.get("imageUrl").asString()).isEqualTo(B);

    JsonNode cleared = body(putJson("/api/v1/admin/spots/" + spot.get("id").asString(), spot("[]", 0L)));
    assertThat(urls(cleared)).isEmpty();
    assertThat(cleared.get("imageUrl").asString()).isEmpty();
  }

  // ---- Helpers ----

  private static List<String> urls(JsonNode item) {
    List<String> out = new ArrayList<>();
    item.get("photos").forEach(u -> out.add(u.asString()));
    return out;
  }

  private ResultActions putJson(String path, String json) throws Exception {
    return mvc.perform(put(path).header(HttpHeaders.AUTHORIZATION, bearer(admin)).contentType(MediaType.APPLICATION_JSON).content(json))
        .andExpect(status().isOk());
  }

  private static String place(String photos, String imageUrl, Long version) {
    return """
        {"type": "cafe", "district": "HOAN_KIEM", "name": "Quán nhiều ảnh %s", "priceRange": "medium", "rating": 4,
         "openTime": "08:00", "closeTime": "22:00", "photos": %s, "imageUrl": %s, "version": %s}
        """
        .formatted(UUID.randomUUID(), photos, imageUrl == null ? "null" : "\"" + imageUrl + "\"", version);
  }

  private static String spot(String photos, Long version) {
    return """
        {"category": "museum", "district": "BA_DINH", "name": "Chỗ nhiều ảnh", "priceFrom": 0, "indoor": true,
         "photos": %s, "version": %s}
        """
        .formatted(photos, version);
  }
}
