package com.gfmaster.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
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

/**
 * "Khám phá quán" do admin nhập; "Add vào My place" sao chép quán vào places của riêng người bấm (cả
 * guest); admin sửa quán thì bản sao cập nhật theo, xoá quán thì bản sao vẫn giữ.
 */
class CatalogIT extends ApiTestSupport {

  @Autowired JdbcTemplate jdbc;

  private UUID admin;
  private UUID guest;

  @BeforeEach
  void setUp() {
    jdbc.update("delete from place_catalog");
    admin = newUser();
    guest = newGuestOf(admin);
  }

  @Test
  void adminCuratesCatalogAndEveryoneSavesToOwnMyPlace() throws Exception {
    // Guest không thêm được quán vào danh mục
    postAs(guest, "/api/v1/admin/catalog", cafe("Cafe Giảng", "HOAN_KIEM", null)).andExpect(status().isForbidden());

    JsonNode giang = body(postAs(admin, "/api/v1/admin/catalog", cafe("Cafe Giảng", "HOAN_KIEM", null)).andExpect(status().isCreated()));
    assertThat(giang.get("district").asString()).isEqualTo("HOAN_KIEM");
    assertThat(giang.get("districtLabel").asString()).isEqualTo("Hoàn Kiếm");
    assertThat(giang.get("version").asLong()).isZero();
    postAs(admin, "/api/v1/admin/catalog", cafe("Highlands Ba Đình", "BA_DINH", null)).andExpect(status().isCreated());
    postAs(admin, "/api/v1/admin/catalog", bar("Polite Pub", "BA_DINH")).andExpect(status().isCreated());

    // Mọi người xem được; tìm không phân biệt hoa thường; lọc khu vực và loại
    getAs(guest, "/api/v1/catalog?q=GIẢNG").andExpect(jsonPath("$.total").value(1));
    getAs(guest, "/api/v1/catalog?district=BA_DINH").andExpect(jsonPath("$.total").value(2));
    getAs(guest, "/api/v1/catalog?district=BA_DINH&type=bar").andExpect(jsonPath("$.items[0].name").value("Polite Pub"));
    getAs(guest, "/api/v1/catalog?size=1000").andExpect(jsonPath("$.size").value(CatalogService.MAX_PAGE_SIZE));

    // Guest add vào My place của chính guest: vào nhóm theo loại của quán, admin không bị ảnh hưởng
    String giangId = giang.get("id").asString();
    postAs(guest, "/api/v1/catalog/" + giangId + "/my-place", "")
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.type").value("cafe"))
        .andExpect(jsonPath("$.name").value("Cafe Giảng"))
        .andExpect(jsonPath("$.rating").value(5));
    getAs(guest, "/api/v1/places?type=cafe").andExpect(jsonPath("$", hasSize(1)));
    getAs(admin, "/api/v1/places").andExpect(jsonPath("$", hasSize(0)));
    getAs(guest, "/api/v1/catalog?q=giảng").andExpect(jsonPath("$.items[0].inMyPlace").value(true));
    getAs(admin, "/api/v1/catalog?q=giảng").andExpect(jsonPath("$.items[0].inMyPlace").value(false));

    // Add lần hai: 409
    postAs(guest, "/api/v1/catalog/" + giangId + "/my-place", "")
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("ALREADY_IN_MY_PLACE"));

    // Admin sửa quán: bản sao trong My place của guest cập nhật theo; version cũ → 409
    putAs(admin, giangId, cafe("Cafe Giảng (mới)", "HOAN_KIEM", 0L)).andExpect(status().isOk()).andExpect(jsonPath("$.version").value(1));
    putAs(admin, giangId, cafe("Cafe Giảng (lại)", "HOAN_KIEM", 0L))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("VERSION_CONFLICT"));
    getAs(guest, "/api/v1/places").andExpect(jsonPath("$[0].name").value("Cafe Giảng (mới)"));
    putAs(guest, giangId, cafe("Guest sửa", "HOAN_KIEM", 1L)).andExpect(status().isForbidden());

    // Admin xoá quán khỏi danh mục: bản sao của guest vẫn còn
    deleteAs(guest, "/api/v1/admin/catalog/" + giangId).andExpect(status().isForbidden());
    deleteAs(admin, "/api/v1/admin/catalog/" + giangId).andExpect(status().isNoContent());
    getAs(guest, "/api/v1/catalog?q=giảng").andExpect(jsonPath("$.total").value(0));
    getAs(guest, "/api/v1/places").andExpect(jsonPath("$", hasSize(1)));
    postAs(guest, "/api/v1/catalog/" + giangId + "/my-place", "").andExpect(status().isNotFound());
  }

  @Test
  void restaurantKeepsCuisineAndDropsCafeAmenities() throws Exception {
    JsonNode item =
        body(
            postAs(
                    admin,
                    "/api/v1/admin/catalog",
                    """
                    {"type": "restaurant", "district": "DONG_DA", "name": "Phở Thìn", "priceRange": "cheap",
                     "rating": 4, "openTime": "06:00", "closeTime": "21:00", "cuisine": "Món Việt", "hasWifi": true}
                    """)
                .andExpect(status().isCreated()));
    assertThat(item.get("cuisine").asString()).isEqualTo("Món Việt");
    assertThat(item.get("hasWifi").isNull()).isTrue();
    postAs(admin, "/api/v1/catalog/" + item.get("id").asString() + "/my-place", "")
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.type").value("restaurant"))
        .andExpect(jsonPath("$.cuisine").value("Món Việt"));
  }

  @Test
  void districtIsRequiredAndValidated() throws Exception {
    postAs(
            admin,
            "/api/v1/admin/catalog",
            """
            {"type": "cafe", "name": "Không khu vực", "priceRange": "cheap", "rating": 3,
             "openTime": "07:00", "closeTime": "22:00"}
            """)
        .andExpect(status().isBadRequest());
    postAs(admin, "/api/v1/admin/catalog", cafe("Sai khu vực", "SAI_GON", null)).andExpect(status().isBadRequest());
    getAs(guest, "/api/v1/catalog/districts")
        .andExpect(jsonPath("$", hasSize(12)))
        .andExpect(jsonPath("$[0].code").value("BA_DINH"))
        .andExpect(jsonPath("$[0].label").value("Ba Đình"));
  }

  // ---- Helpers ----

  private ResultActions putAs(UUID user, String id, String body) throws Exception {
    return mvc.perform(
        put("/api/v1/admin/catalog/" + id)
            .header(HttpHeaders.AUTHORIZATION, bearer(user))
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
  }

  private static String cafe(String name, String district, Long version) {
    return """
        {"type": "cafe", "district": "%s", "name": "%s", "address": "39 Nguyễn Hữu Huân",
         "priceRange": "medium", "rating": 5, "openTime": "07:00", "closeTime": "22:00",
         "hasWifi": true, "hasParking": false, "lat": 21.0285, "lng": 105.8543, "version": %s}
        """
        .formatted(district, name, version);
  }

  private static String bar(String name, String district) {
    return """
        {"type": "bar", "district": "%s", "name": "%s", "priceRange": "high", "rating": 4,
         "openTime": "17:00", "closeTime": "23:30"}
        """
        .formatted(district, name);
  }
}
