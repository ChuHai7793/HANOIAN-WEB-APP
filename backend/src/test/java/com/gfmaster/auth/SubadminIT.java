package com.gfmaster.auth;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gfmaster.support.ApiTestSupport;
import com.gfmaster.user.User;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Subadmin (V20): role ADMIN, owner_id = admin. Được ghi như admin và làm việc trên chính dữ liệu của admin
 * (người yêu, liên kết, My place). Guest của admin vẫn có My place riêng.
 */
class SubadminIT extends ApiTestSupport {

  private UUID newSubadminOf(UUID admin) {
    User u = new User();
    u.setEmail("s-" + UUID.randomUUID() + "@test.local");
    u.setPasswordHash("x");
    u.setDisplayName("Subadmin");
    u.setOwnerId(admin);
    return users.saveAndFlush(u).getId();
  }

  @Test
  void subadminSharesAdminDataWithWriteAccess() throws Exception {
    UUID admin = newUser();
    UUID sub = newSubadminOf(admin);
    UUID guest = newGuestOf(admin);

    // Dữ liệu admin tạo: subadmin thấy và sửa được
    String placeId = createPlace(admin, "cafe", "Của admin").get("id").asString();
    String gfId = createGirlfriend(admin, "Mai").get("id").asString();
    getAs(sub, "/api/v1/places").andExpect(jsonPath("$", hasSize(1))).andExpect(jsonPath("$[0].name").value("Của admin"));
    getAs(sub, "/api/v1/girlfriends").andExpect(jsonPath("$[0].name").value("Mai"));
    patchAs(sub, "/api/v1/places/" + placeId, "{\"name\": \"Subadmin sửa\", \"version\": 0}").andExpect(status().isOk());
    patchAs(sub, "/api/v1/girlfriends/" + gfId, "{\"name\": \"Mai 2\", \"version\": 0}").andExpect(status().isOk());

    // Dữ liệu subadmin tạo: thuộc admin
    String subPlace = createPlace(sub, "bar", "Subadmin thêm").get("id").asString();
    createGirlfriend(sub, "Lan");
    getAs(admin, "/api/v1/places").andExpect(jsonPath("$", hasSize(2)));
    getAs(admin, "/api/v1/places/" + placeId).andExpect(jsonPath("$.name").value("Subadmin sửa"));
    getAs(admin, "/api/v1/girlfriends").andExpect(jsonPath("$", hasSize(2)));

    // Chỗ chơi lưu vào My place: dùng chung
    String spotId = body(postAs(sub, "/api/v1/admin/spots", """
        {"category": "museum", "district": "BA_DINH", "name": "Chỗ %s", "priceFrom": 0, "indoor": true}
        """.formatted(UUID.randomUUID())).andExpect(status().isCreated())).get("id").asString();
    postAs(sub, "/api/v1/spots/" + spotId + "/my-place", "").andExpect(status().isCreated());
    getAs(admin, "/api/v1/me/spots").andExpect(jsonPath("$", hasSize(1)));

    // Guest vẫn có My place riêng
    getAs(guest, "/api/v1/places").andExpect(jsonPath("$", hasSize(0)));
    getAs(guest, "/api/v1/me/spots").andExpect(jsonPath("$", hasSize(0)));

    deleteAs(sub, "/api/v1/places/" + subPlace).andExpect(status().isNoContent());
    getAs(admin, "/api/v1/places").andExpect(jsonPath("$", hasSize(1)));
  }
}
