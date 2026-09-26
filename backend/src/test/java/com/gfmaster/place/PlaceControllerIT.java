package com.gfmaster.place;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gfmaster.support.ApiTestSupport;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.JsonNode;

class PlaceControllerIT extends ApiTestSupport {

  @Autowired JdbcTemplate jdbc;

  @Test
  void createReturnsFullResourceWithHHmmTimes() throws Exception {
    UUID user = newUser();
    String req =
        """
        {"type": "cafe", "name": "Cộng Cà Phê", "priceRange": "medium", "rating": 4,
         "openTime": "07:30", "closeTime": "23:00", "hasWifi": true, "cuisine": "bị bỏ vì là cafe",
         "id": "client-id-bi-bo-qua", "createdAt": "2026-01-01T00:00:00Z"}
        """;
    postAs(user, "/api/v1/places", req)
        .andExpect(status().isCreated())
        .andExpect(header().exists("Location"))
        .andExpect(jsonPath("$.id").isNotEmpty())
        .andExpect(jsonPath("$.type").value("cafe"))
        .andExpect(jsonPath("$.openTime").value("07:30"))
        .andExpect(jsonPath("$.address").value(""))
        .andExpect(jsonPath("$.cuisine").isEmpty())
        .andExpect(jsonPath("$.lat").isEmpty())
        .andExpect(jsonPath("$.version").value(0));
  }

  /**
   * Hồi quy: TIME trong DB không được quy đổi múi giờ. Trước đây jdbc.time_zone=UTC làm '08:00'
   * đọc ra thành "16:00" trên máy UTC+7. Kiểm tra cả hai chiều bằng SQL thô, không chỉ round-trip.
   */
  @Test
  void timeColumnsAreNotShiftedByJvmTimezone() throws Exception {
    UUID user = newUser();
    String id = createPlace(user, "cafe", "Giờ mở cửa").get("id").asString();
    assertThat(jdbc.queryForObject("select cast(open_time as char) from places where id = ?", String.class, id))
        .isEqualTo("08:00:00");

    jdbc.update("update places set open_time = '06:45:00' where id = ?", id);
    getAs(user, "/api/v1/places/" + id).andExpect(jsonPath("$.openTime").value("06:45"));
  }

  @Test
  void restaurantDropsCafeOnlyFields() throws Exception {
    UUID user = newUser();
    String req =
        """
        {"type": "restaurant", "name": "Gogi", "priceRange": "high", "rating": 5,
         "openTime": "10:00", "closeTime": "22:00", "hasWifi": true, "cuisine": "Nướng BBQ"}
        """;
    postAs(user, "/api/v1/places", req)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.cuisine").value("Nướng BBQ"))
        .andExpect(jsonPath("$.hasWifi").isEmpty());
  }

  @Test
  void listFiltersByType() throws Exception {
    UUID user = newUser();
    createPlace(user, "cafe", "A");
    createPlace(user, "bar", "B");
    createPlace(user, "cafe", "C");

    getAs(user, "/api/v1/places").andExpect(jsonPath("$", hasSize(3)));
    getAs(user, "/api/v1/places?type=cafe")
        .andExpect(jsonPath("$", hasSize(2)))
        .andExpect(jsonPath("$[0].name").value("C")); // mới nhất trước
  }

  @Test
  void patchChangesOnlySentFieldsAndBumpsVersion() throws Exception {
    UUID user = newUser();
    JsonNode p = createPlace(user, "cafe", "Cũ");
    String id = p.get("id").asString();

    patchAs(user, "/api/v1/places/" + id, "{\"name\": \"Mới\", \"version\": 0}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Mới"))
        .andExpect(jsonPath("$.address").value("1 Lê Lợi"))
        .andExpect(jsonPath("$.lat").value(10.7743))
        .andExpect(jsonPath("$.version").value(1));

    // null trên field tuỳ chọn → xoá; null trên field bắt buộc → bỏ qua
    patchAs(user, "/api/v1/places/" + id, "{\"lat\": null, \"lng\": null, \"name\": null, \"version\": 1}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.lat").isEmpty())
        .andExpect(jsonPath("$.lng").isEmpty())
        .andExpect(jsonPath("$.name").value("Mới"));
  }

  @Test
  void patchWithStaleVersionReturns409WithCurrent() throws Exception {
    UUID user = newUser();
    String id = createPlace(user, "bar", "Bar").get("id").asString();
    patchAs(user, "/api/v1/places/" + id, "{\"rating\": 5, \"version\": 0}").andExpect(status().isOk());

    patchAs(user, "/api/v1/places/" + id, "{\"rating\": 1, \"version\": 0}")
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("VERSION_CONFLICT"))
        .andExpect(jsonPath("$.current.rating").value(5))
        .andExpect(jsonPath("$.current.version").value(1));
  }

  @Test
  void patchRequiresVersion() throws Exception {
    UUID user = newUser();
    String id = createPlace(user, "bar", "Bar").get("id").asString();
    patchAs(user, "/api/v1/places/" + id, "{\"rating\": 5}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
        .andExpect(jsonPath("$.errors[0].field").value("version"));
  }

  @Test
  void validationErrors() throws Exception {
    UUID user = newUser();
    String bad =
        """
        {"type": "cafe", "name": "", "priceRange": "medium", "rating": 9,
         "openTime": "07:30", "closeTime": "23:00", "imageUrl": "data:image/png;base64,AAAA"}
        """;
    JsonNode err = body(postAs(user, "/api/v1/places", bad).andExpect(status().isBadRequest()));
    assertThat(err.get("code").asString()).isEqualTo("VALIDATION_FAILED");
    assertThat(err.get("errors").valueStream().map(e -> e.get("field").asString()))
        .containsExactlyInAnyOrder("name", "rating", "imageUrl");

    postAs(user, "/api/v1/places", "{\"type\": \"hotel\"}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
    postAs(user, "/api/v1/places", "{\"type\": \"cafe\", \"hacker\": true}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
  }

  @Test
  void otherUserGets404Everywhere() throws Exception {
    UUID owner = newUser();
    UUID stranger = newUser();
    String id = createPlace(owner, "cafe", "Riêng tư").get("id").asString();

    getAs(stranger, "/api/v1/places/" + id)
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    patchAs(stranger, "/api/v1/places/" + id, "{\"name\": \"x\", \"version\": 0}")
        .andExpect(status().isNotFound());
    deleteAs(stranger, "/api/v1/places/" + id).andExpect(status().isNotFound());
    getAs(stranger, "/api/v1/places").andExpect(jsonPath("$", hasSize(0)));

    getAs(owner, "/api/v1/places/" + id).andExpect(jsonPath("$.name").value("Riêng tư"));
  }

  @Test
  void deleteCascadesLinks() throws Exception {
    UUID user = newUser();
    String placeId = createPlace(user, "cafe", "Sắp xoá").get("id").asString();
    String gfId = createGirlfriend(user, "Mai").get("id").asString();
    createLink(user, gfId, placeId, 5);

    deleteAs(user, "/api/v1/places/" + placeId).andExpect(status().isNoContent());

    getAs(user, "/api/v1/places/" + placeId).andExpect(status().isNotFound());
    getAs(user, "/api/v1/place-links?girlfriendId=" + gfId).andExpect(jsonPath("$", hasSize(0)));
    getAs(user, "/api/v1/girlfriends/" + gfId).andExpect(jsonPath("$.placeCount").value(0));
  }
}
