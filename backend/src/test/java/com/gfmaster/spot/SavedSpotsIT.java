package com.gfmaster.spot;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gfmaster.support.ApiTestSupport;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** "Lưu vào My place" cho chỗ chơi: mỗi người một danh sách, guest cũng lưu được. */
class SavedSpotsIT extends ApiTestSupport {

  @Test
  void saveListAndUnsave() throws Exception {
    UUID admin = newUser();
    UUID guest = newGuestOf(admin);
    String name = "Chỗ để lưu " + UUID.randomUUID();
    String id = body(postAs(admin, "/api/v1/admin/spots", """
        {"category": "museum", "district": "BA_DINH", "name": "%s", "priceFrom": 0, "indoor": true}
        """.formatted(name)).andExpect(status().isCreated())).get("id").asString();

    // Guest lưu được (ghi vào My place của chính mình)
    postAs(guest, "/api/v1/spots/" + id + "/my-place", "").andExpect(status().isCreated()).andExpect(jsonPath("$.inMyPlace").value(true));
    postAs(guest, "/api/v1/spots/" + id + "/my-place", "").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ALREADY_IN_MY_PLACE"));

    // Danh sách tìm kiếm đánh dấu theo người xem; My place chỉ của người lưu
    getAs(guest, "/api/v1/spots?q=" + name).andExpect(jsonPath("$.items[0].inMyPlace").value(true));
    getAs(admin, "/api/v1/spots?q=" + name).andExpect(jsonPath("$.items[0].inMyPlace").value(false));
    getAs(guest, "/api/v1/me/spots").andExpect(jsonPath("$", hasSize(1))).andExpect(jsonPath("$[0].id").value(id));
    getAs(admin, "/api/v1/me/spots").andExpect(jsonPath("$", hasSize(0)));

    deleteAs(guest, "/api/v1/spots/" + id + "/my-place").andExpect(status().isNoContent());
    deleteAs(guest, "/api/v1/spots/" + id + "/my-place").andExpect(status().isNotFound());
    getAs(guest, "/api/v1/me/spots").andExpect(jsonPath("$", hasSize(0)));

    // Admin xoá chỗ chơi: mục đã lưu mất theo
    postAs(guest, "/api/v1/spots/" + id + "/my-place", "").andExpect(status().isCreated());
    deleteAs(admin, "/api/v1/admin/spots/" + id).andExpect(status().isNoContent());
    getAs(guest, "/api/v1/me/spots").andExpect(jsonPath("$", hasSize(0)));
    postAs(guest, "/api/v1/spots/" + UUID.randomUUID() + "/my-place", "").andExpect(status().isNotFound());
  }
}
