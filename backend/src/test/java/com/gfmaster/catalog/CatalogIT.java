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
    // Bản trong My place nhớ quán gốc (để thêm vào plan từ My place)
    getAs(guest, "/api/v1/places").andExpect(jsonPath("$[0].catalogId").value(giangId));
    getAs(admin, "/api/v1/places").andExpect(jsonPath("$", hasSize(0)));
    getAs(guest, "/api/v1/catalog?q=giảng").andExpect(jsonPath("$.items[0].inMyPlace").value(true));
    getAs(admin, "/api/v1/catalog?q=giảng").andExpect(jsonPath("$.items[0].inMyPlace").value(false));

    // Add lần hai: 409
    postAs(guest, "/api/v1/catalog/" + giangId + "/my-place", "")
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("ALREADY_IN_MY_PLACE"));

    // Bỏ khỏi My place: admin không xoá được quán của guest; guest bỏ được rồi add lại được
    String guestCopy = body(getAs(guest, "/api/v1/places")).get(0).get("id").asString();
    deleteAs(admin, "/api/v1/places/" + guestCopy).andExpect(status().isNotFound());
    deleteAs(guest, "/api/v1/places/" + guestCopy).andExpect(status().isNoContent());
    getAs(guest, "/api/v1/places").andExpect(jsonPath("$", hasSize(0)));
    getAs(guest, "/api/v1/catalog?q=giảng").andExpect(jsonPath("$.items[0].inMyPlace").value(false));
    postAs(guest, "/api/v1/catalog/" + giangId + "/my-place", "").andExpect(status().isCreated());

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
  void adminChangesTypeAndSavedCopiesFollow() throws Exception {
    JsonNode item =
        body(
            postAs(
                    admin,
                    "/api/v1/admin/catalog",
                    """
                    {"type": "restaurant", "district": "DONG_DA", "name": "Đổi loại", "priceRange": "cheap",
                     "rating": 4, "openTime": "07:00", "closeTime": "21:00", "cuisine": "Món Việt"}
                    """)
                .andExpect(status().isCreated()));
    String id = item.get("id").asString();
    postAs(guest, "/api/v1/catalog/" + id + "/my-place", "").andExpect(status().isCreated());

    // Quán ăn → cafe: bỏ loại món, nhận wifi / chỗ đỗ xe
    putAs(
            admin,
            id,
            """
            {"type": "cafe", "district": "DONG_DA", "name": "Đổi loại", "priceRange": "cheap", "rating": 4,
             "openTime": "07:00", "closeTime": "21:00", "cuisine": "Món Việt", "hasWifi": true, "hasParking": false,
             "version": 0}
            """)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.type").value("cafe"))
        .andExpect(jsonPath("$.cuisine").isEmpty())
        .andExpect(jsonPath("$.hasWifi").value(true));
    getAs(guest, "/api/v1/catalog?type=cafe&q=Đổi loại").andExpect(jsonPath("$.total").value(1));
    getAs(guest, "/api/v1/catalog?type=restaurant&q=Đổi loại").andExpect(jsonPath("$.total").value(0));
    // Bản đã lưu trong My place của guest sang nhóm cafe theo
    getAs(guest, "/api/v1/places?type=cafe").andExpect(jsonPath("$", hasSize(1))).andExpect(jsonPath("$[0].cuisine").isEmpty());
    getAs(guest, "/api/v1/places?type=restaurant").andExpect(jsonPath("$", hasSize(0)));
  }

  @Test
  void placeHasConcretePricePerPersonCopiedToMyPlace() throws Exception {
    JsonNode item =
        body(
            postAs(
                    admin,
                    "/api/v1/admin/catalog",
                    """
                    {"type": "restaurant", "district": "HOAN_KIEM", "name": "Giá cụ thể", "priceRange": "medium",
                     "priceFrom": 80000, "priceTo": 150000, "rating": 4, "openTime": "10:00", "closeTime": "21:00"}
                    """)
                .andExpect(status().isCreated()));
    assertThat(item.get("priceFrom").asInt()).isEqualTo(80000);
    assertThat(item.get("priceTo").asInt()).isEqualTo(150000);
    String id = item.get("id").asString();
    postAs(guest, "/api/v1/catalog/" + id + "/my-place", "").andExpect(status().isCreated());
    getAs(guest, "/api/v1/places?type=restaurant").andExpect(jsonPath("$[0].priceFrom").value(80000)).andExpect(jsonPath("$[0].priceTo").value(150000));

    // "Đến" nhỏ hơn "từ", hoặc có "đến" mà không có "từ": 400
    String base = """
        {"type": "restaurant", "district": "HOAN_KIEM", "name": "Giá cụ thể", "priceRange": "medium", %s
         "rating": 4, "openTime": "10:00", "closeTime": "21:00", "version": 0}
        """;
    putAs(admin, id, base.formatted("\"priceFrom\": 150000, \"priceTo\": 80000,")).andExpect(status().isBadRequest());
    putAs(admin, id, base.formatted("\"priceTo\": 80000,")).andExpect(status().isBadRequest());
    putAs(admin, id, base.formatted("\"priceFrom\": -1,")).andExpect(status().isBadRequest());

    // Chỉ có giá từ; bản trong My place đổi theo
    putAs(admin, id, base.formatted("\"priceFrom\": 60000,"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.priceFrom").value(60000))
        .andExpect(jsonPath("$.priceTo").isEmpty());
    getAs(guest, "/api/v1/places?type=restaurant").andExpect(jsonPath("$[0].priceFrom").value(60000)).andExpect(jsonPath("$[0].priceTo").isEmpty());
  }

  @Test
  void detailedFiltersAndSort() throws Exception {
    // Rẻ, cafe chill mở cả ngày, có wifi
    place("""
        {"type": "cafe", "district": "BA_DINH", "name": "A cafe", "priceRange": "cheap", "priceFrom": 30000, "priceTo": 45000,
         "rating": 3, "openTime": "07:00", "closeTime": "22:00", "hasWifi": true, "hasParking": false, "vibes": ["chill"]}
        """);
    // Quán ăn Nhật tầm trung, lãng mạn, chưa nhập giá cụ thể (tính từ 50k)
    place("""
        {"type": "restaurant", "district": "BA_DINH", "name": "B sushi", "priceRange": "medium", "rating": 5,
         "openTime": "11:00", "closeTime": "21:00", "cuisine": "Món Nhật", "vibes": ["romantic"]}
        """);
    // Bar sang, mở qua đêm
    place("""
        {"type": "bar", "district": "BA_DINH", "name": "C bar", "priceRange": "luxury", "priceFrom": 450000,
         "rating": 4, "openTime": "18:00", "closeTime": "02:00", "vibes": ["romantic", "active"]}
        """);

    getAs(guest, "/api/v1/catalog?price=cheap,medium").andExpect(jsonPath("$.total").value(2));
    // Ngân sách: giá thấp nhất ≤ 50k (B sushi chưa có giá, tính 50k theo nhóm tầm trung)
    getAs(guest, "/api/v1/catalog?budget=50000").andExpect(jsonPath("$.total").value(2));
    getAs(guest, "/api/v1/catalog?budget=40000").andExpect(jsonPath("$.items[0].name").value("A cafe")).andExpect(jsonPath("$.total").value(1));
    getAs(guest, "/api/v1/catalog?stars=4").andExpect(jsonPath("$.total").value(2));
    getAs(guest, "/api/v1/catalog?cuisine=Món Nhật,Món Việt").andExpect(jsonPath("$.items[0].name").value("B sushi")).andExpect(jsonPath("$.total").value(1));
    getAs(guest, "/api/v1/catalog?vibe=romantic").andExpect(jsonPath("$.total").value(2));
    getAs(guest, "/api/v1/catalog?vibe=chill,active").andExpect(jsonPath("$.total").value(2));
    getAs(guest, "/api/v1/catalog?wifi=true").andExpect(jsonPath("$.total").value(1));
    // Đang mở: 23:30 chỉ còn bar mở qua đêm; 12:00 cafe và quán ăn
    getAs(guest, "/api/v1/catalog?openAt=23:30").andExpect(jsonPath("$.items[0].name").value("C bar")).andExpect(jsonPath("$.total").value(1));
    getAs(guest, "/api/v1/catalog?openAt=12:00").andExpect(jsonPath("$.total").value(2));
    // Kết hợp nhiều bộ lọc
    getAs(guest, "/api/v1/catalog?vibe=romantic&stars=5&budget=100000").andExpect(jsonPath("$.total").value(1));

    // Sắp xếp
    getAs(guest, "/api/v1/catalog?sort=rating").andExpect(jsonPath("$.items[0].name").value("B sushi"));
    getAs(guest, "/api/v1/catalog?sort=price")
        .andExpect(jsonPath("$.items[0].name").value("A cafe"))
        .andExpect(jsonPath("$.items[2].name").value("C bar"));

    // Số trên chip loại quán theo bộ lọc
    getAs(guest, "/api/v1/catalog/counts?vibe=romantic")
        .andExpect(jsonPath("$.all").value(2))
        .andExpect(jsonPath("$.cafe").value(0))
        .andExpect(jsonPath("$.restaurant").value(1));
  }

  private void place(String json) throws Exception {
    postAs(admin, "/api/v1/admin/catalog", json).andExpect(status().isCreated());
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

  @Test
  void countsPerTypeFollowSearchAndDistrict() throws Exception {
    postAs(admin, "/api/v1/admin/catalog", cafe("Cafe Giảng", "HOAN_KIEM", null)).andExpect(status().isCreated());
    postAs(admin, "/api/v1/admin/catalog", cafe("Highlands Ba Đình", "BA_DINH", null)).andExpect(status().isCreated());
    postAs(admin, "/api/v1/admin/catalog", bar("Polite Pub", "BA_DINH")).andExpect(status().isCreated());

    getAs(guest, "/api/v1/catalog/counts")
        .andExpect(jsonPath("$.all").value(3))
        .andExpect(jsonPath("$.cafe").value(2))
        .andExpect(jsonPath("$.bar").value(1))
        .andExpect(jsonPath("$.restaurant").value(0));
    getAs(guest, "/api/v1/catalog/counts?district=BA_DINH").andExpect(jsonPath("$.all").value(2)).andExpect(jsonPath("$.cafe").value(1));
    getAs(guest, "/api/v1/catalog/counts?q=pub").andExpect(jsonPath("$.all").value(1)).andExpect(jsonPath("$.bar").value(1));
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
