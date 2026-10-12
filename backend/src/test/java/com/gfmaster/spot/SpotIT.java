package com.gfmaster.spot;

import static org.assertj.core.api.Assertions.assertThat;
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
import tools.jackson.databind.JsonNode;

/** "Tìm chỗ chơi": admin nhập, mọi người xem và lọc theo nhóm, khu vực, giá, trong nhà, giờ mở cửa. */
class SpotIT extends ApiTestSupport {

  @Autowired JdbcTemplate jdbc;

  private UUID admin;
  private UUID guest;

  @BeforeEach
  void setUp() {
    jdbc.update("delete from date_spots");
    admin = newUser();
    guest = newGuestOf(admin);
  }

  @Test
  void adminCuratesSpotsAndEveryoneBrowses() throws Exception {
    // Guest không thêm được
    postAs(guest, "/api/v1/admin/spots", museum("Bảo tàng Phụ nữ", null)).andExpect(status().isForbidden());

    JsonNode museum = body(postAs(admin, "/api/v1/admin/spots", museum("Bảo tàng Phụ nữ", null)).andExpect(status().isCreated()));
    assertThat(museum.get("districtLabel").asString()).isEqualTo("Hoàn Kiếm");
    assertThat(museum.get("openTime").asString()).isEqualTo("08:00");
    assertThat(museum.get("version").asLong()).isZero();
    postAs(admin, "/api/v1/admin/spots", lake()).andExpect(status().isCreated());

    getAs(guest, "/api/v1/spots").andExpect(jsonPath("$.total").value(2));
    getAs(guest, "/api/v1/spots?q=PHỤ NỮ").andExpect(jsonPath("$.total").value(1));
    getAs(guest, "/api/v1/spots?category=outdoor").andExpect(jsonPath("$.items[0].name").value("Hồ Gươm"));
    getAs(guest, "/api/v1/spots?district=TAY_HO").andExpect(jsonPath("$.total").value(0));
    getAs(guest, "/api/v1/spots?size=1000").andExpect(jsonPath("$.size").value(SpotService.MAX_PAGE_SIZE));

    // Admin sửa; version cũ → 409 kèm bản hiện tại
    String id = museum.get("id").asString();
    putAs(admin, id, museum("Bảo tàng Phụ nữ Việt Nam", 0L)).andExpect(status().isOk()).andExpect(jsonPath("$.version").value(1));
    putAs(admin, id, museum("Lại", 0L))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("VERSION_CONFLICT"))
        .andExpect(jsonPath("$.current.name").value("Bảo tàng Phụ nữ Việt Nam"));
    putAs(guest, id, museum("Guest sửa", 1L)).andExpect(status().isForbidden());

    deleteAs(guest, "/api/v1/admin/spots/" + id).andExpect(status().isForbidden());
    deleteAs(admin, "/api/v1/admin/spots/" + id).andExpect(status().isNoContent());
    deleteAs(admin, "/api/v1/admin/spots/" + id).andExpect(status().isNotFound());
    getAs(guest, "/api/v1/spots").andExpect(jsonPath("$.total").value(1));
  }

  @Test
  void filtersByBudgetIndoorAndOpeningHours() throws Exception {
    postAs(admin, "/api/v1/admin/spots", museum("Bảo tàng", null)).andExpect(status().isCreated()); // 40k, 08–17, trong nhà
    postAs(admin, "/api/v1/admin/spots", lake()).andExpect(status().isCreated()); // miễn phí, không giờ cố định
    postAs(
            admin,
            "/api/v1/admin/spots",
            """
            {"category": "entertainment", "district": "CAU_GIAY", "name": "Music box", "priceFrom": 150000,
             "priceTo": 300000, "openTime": "18:00", "closeTime": "02:00", "indoor": true}
            """)
        .andExpect(status().isCreated()); // mở qua nửa đêm

    getAs(guest, "/api/v1/spots?maxPrice=0").andExpect(jsonPath("$.items[0].name").value("Hồ Gươm")).andExpect(jsonPath("$.total").value(1));
    getAs(guest, "/api/v1/spots?maxPrice=100000").andExpect(jsonPath("$.total").value(2));
    getAs(guest, "/api/v1/spots?indoor=true").andExpect(jsonPath("$.total").value(2));

    // 10:00: bảo tàng + hồ; 23:00 và 01:30: music box + hồ; 17:00 bảo tàng đã đóng
    getAs(guest, "/api/v1/spots?openAt=10:00").andExpect(jsonPath("$.total").value(2)).andExpect(jsonPath("$.items[0].name").value("Bảo tàng"));
    getAs(guest, "/api/v1/spots?openAt=23:00").andExpect(jsonPath("$.items[1].name").value("Music box")).andExpect(jsonPath("$.total").value(2));
    getAs(guest, "/api/v1/spots?openAt=01:30").andExpect(jsonPath("$.total").value(2));
    getAs(guest, "/api/v1/spots?openAt=17:00").andExpect(jsonPath("$.total").value(1));
    getAs(guest, "/api/v1/spots?openAt=10:00&indoor=true").andExpect(jsonPath("$.total").value(1));
  }

  @Test
  void countsPerCategoryFollowOtherFilters() throws Exception {
    postAs(admin, "/api/v1/admin/spots", museum("Bảo tàng", null)).andExpect(status().isCreated());
    postAs(admin, "/api/v1/admin/spots", lake()).andExpect(status().isCreated());

    getAs(guest, "/api/v1/spots/counts")
        .andExpect(jsonPath("$.all").value(2))
        .andExpect(jsonPath("$.museum").value(1))
        .andExpect(jsonPath("$.outdoor").value(1))
        .andExpect(jsonPath("$.workshop").value(0));
    getAs(guest, "/api/v1/spots/counts?maxPrice=0").andExpect(jsonPath("$.all").value(1)).andExpect(jsonPath("$.museum").value(0));
  }

  @Test
  void rejectsInvalidPriceAndHalfOpeningHours() throws Exception {
    postAs(
            admin,
            "/api/v1/admin/spots",
            """
            {"category": "workshop", "district": "HOAN_KIEM", "name": "Gốm", "priceFrom": 300000, "priceTo": 100000,
             "indoor": true}
            """)
        .andExpect(status().isBadRequest());
    postAs(
            admin,
            "/api/v1/admin/spots",
            """
            {"category": "workshop", "district": "HOAN_KIEM", "name": "Gốm", "priceFrom": 0, "openTime": "09:00",
             "indoor": true}
            """)
        .andExpect(status().isBadRequest());
    postAs(
            admin,
            "/api/v1/admin/spots",
            """
            {"category": "sai", "district": "HOAN_KIEM", "name": "Gốm", "priceFrom": 0, "indoor": true}
            """)
        .andExpect(status().isBadRequest());
    // Giá đến bằng giá từ: lưu thành một mức giá
    postAs(
            admin,
            "/api/v1/admin/spots",
            """
            {"category": "workshop", "district": "HOAN_KIEM", "name": "Nến", "priceFrom": 250000, "priceTo": 250000,
             "indoor": true}
            """)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.priceTo").isEmpty());
  }

  // ---- Helpers ----

  private ResultActions putAs(UUID user, String id, String body) throws Exception {
    return mvc.perform(
        put("/api/v1/admin/spots/" + id)
            .header(HttpHeaders.AUTHORIZATION, bearer(user))
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
  }

  private static String museum(String name, Long version) {
    return """
        {"category": "museum", "district": "HOAN_KIEM", "name": "%s", "address": "36 Lý Thường Kiệt",
         "priceFrom": 40000, "openTime": "08:00", "closeTime": "17:00", "durationMin": 90, "indoor": true,
         "version": %s}
        """
        .formatted(name, version);
  }

  private static String lake() {
    return """
        {"category": "outdoor", "district": "HOAN_KIEM", "name": "Hồ Gươm", "priceFrom": 0, "indoor": false,
         "hoursNote": "Phố đi bộ: tối thứ 6 đến chủ nhật", "lat": 21.0287, "lng": 105.8524}
        """;
  }
}
