package com.gfmaster.plan;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gfmaster.support.ApiTestSupport;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.JsonNode;

/** Plan: tạo, thêm / đổi thứ tự / xoá điểm, lịch trình, Autoplan, Đổi, rủ đi qua tin nhắn, chép, kỷ niệm. */
class PlanIT extends ApiTestSupport {

  @Autowired JdbcTemplate jdbc;
  private UUID admin;
  private String cafe;
  private String restaurant;
  private String bar;
  private String workshop;

  @BeforeEach
  void setUp() throws Exception {
    jdbc.update("delete from place_catalog");
    jdbc.update("delete from date_spots");
    jdbc.update("update user_profiles set dating_enabled = false");
    admin = newUser();
    cafe = id(postAs(admin, "/api/v1/admin/catalog", place("cafe", "Cafe Giảng", 21.0335, 105.8543)));
    restaurant = id(postAs(admin, "/api/v1/admin/catalog", place("restaurant", "Phở Lý Quốc Sư", 21.0300, 105.8490)));
    bar = id(postAs(admin, "/api/v1/admin/catalog", place("bar", "Polite Pub", 21.0290, 105.8500)));
    workshop = id(postAs(admin, "/api/v1/admin/spots", spot("Làm nến thơm")));
  }

  @Test
  void ownerBuildsPlanWithTimeline() throws Exception {
    UUID me = newUser();
    UUID stranger = newUser();
    String plan = id(postAs(me, "/api/v1/plans", planJson("Tối thứ 7", "18:00", null)));
    String base = "/api/v1/plans/" + plan;

    postAs(me, base + "/stops", stop("spot", workshop, null)).andExpect(status().isOk());
    postAs(me, base + "/stops", stop("place", restaurant, null)).andExpect(status().isOk());
    JsonNode view = body(postAs(me, base + "/stops", stop("place", cafe, null)));

    // Workshop 120 phút (thời lượng gợi ý của chỗ chơi) → phở; phở 60 phút → cafe, giờ tự tính
    assertThat(names(view)).containsExactly("Làm nến thơm", "Phở Lý Quốc Sư", "Cafe Giảng");
    assertThat(view.get("stops").get(0).get("arrival").asString()).isEqualTo("18:00");
    assertThat(view.get("stops").get(1).get("arrival").asString()).isEqualTo("20:10"); // 18:00 + 120 + 10 (thiếu toạ độ)
    JsonNode third = view.get("stops").get(2);
    assertThat(third.get("travelMode").asString()).isEqualTo("walk");
    assertThat(third.get("distanceFromPrevM").asInt()).isBetween(600, 900);
    assertThat(view.get("mine").asBoolean()).isTrue();

    // Đổi thứ tự, xoá điểm (vị trí đánh lại), sửa thời lượng
    List<String> ids = stopIds(view);
    JsonNode reordered = body(putJson(me, base + "/stops/order", "{\"stopIds\": [\"%s\", \"%s\", \"%s\"]}".formatted(ids.get(2), ids.get(0), ids.get(1))));
    assertThat(names(reordered)).containsExactly("Cafe Giảng", "Làm nến thơm", "Phở Lý Quốc Sư");
    JsonNode afterDelete = body(deleteAs(me, base + "/stops/" + ids.get(0)).andExpect(status().isOk()));
    assertThat(names(afterDelete)).containsExactly("Cafe Giảng", "Phở Lý Quốc Sư");
    assertThat(afterDelete.get("stops").get(1).get("position").asInt()).isEqualTo(1);
    JsonNode patched = body(patchJson(me, base + "/stops/" + ids.get(2), "{\"durationMin\": 30, \"note\": \"Đặt bàn 19h\"}"));
    assertThat(patched.get("stops").get(0).get("durationMin").asInt()).isEqualTo(30);
    assertThat(patched.get("stops").get(0).get("note").asString()).isEqualTo("Đặt bàn 19h");

    // Đổi: cafe chỉ có một → hết phương án; điểm quán ăn có thể đổi sang... không có quán ăn khác → 409
    postAs(me, base + "/stops/" + ids.get(2) + "/swap", "{}").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("NO_ALTERNATIVE"));

    // Người khác không xem / sửa được; danh sách chỉ có plan của mình
    getAs(stranger, base).andExpect(status().isNotFound());
    postAs(stranger, base + "/stops", stop("place", bar, null)).andExpect(status().isNotFound());
    getAs(me, "/api/v1/plans").andExpect(jsonPath("$", hasSize(1))).andExpect(jsonPath("$[0].stopCount").value(2));
    getAs(stranger, "/api/v1/plans").andExpect(jsonPath("$", hasSize(0)));

    // Sửa phần chung cần version đúng
    long version = patched.get("version").asLong();
    putJson(me, base, planJson("Tối CN", "19:00", version)).andExpect(status().isOk());
    putJson(me, base, planJson("Tối CN", "19:00", version)).andExpect(status().isConflict());

    deleteAs(me, base).andExpect(status().isNoContent());
    getAs(me, base).andExpect(status().isNotFound());
  }

  @Test
  void autoplanAndSwap() throws Exception {
    UUID me = newUser();
    String extraCafe = id(postAs(admin, "/api/v1/admin/catalog", place("cafe", "Cafe Đinh", 21.0330, 105.8530)));
    JsonNode result =
        body(postAs(me, "/api/v1/plans/autoplan", "{\"district\": \"HOAN_KIEM\", \"slot\": \"evening\", \"vibe\": \"romantic\", \"date\": \"%s\"}".formatted(LocalDate.now().plusDays(3))).andExpect(status().isCreated()));
    JsonNode plan = result.get("plan");
    // Tối lãng mạn: chỗ chơi → quán ăn → bar
    assertThat(categories(plan)).containsExactly("workshop", "restaurant", "bar");
    assertThat(plan.get("title").asString()).startsWith("Tối ở Hoàn Kiếm");
    assertThat(plan.get("vibe").asString()).isEqualTo("romantic");
    assertThat(plan.get("startTime").asString()).isEqualTo("18:00");

    // Đổi bar sang cafe? Không: Đổi giữ cùng loại; chỉ có một bar → 409. Cafe thì có hai.
    String planId = plan.get("id").asString();
    String cafeStop = body(postAs(me, "/api/v1/plans/" + planId + "/stops", stop("place", cafe, null))).get("stops").get(3).get("id").asString();
    JsonNode swapped = body(postAs(me, "/api/v1/plans/" + planId + "/stops/" + cafeStop + "/swap", "{}").andExpect(status().isOk()));
    assertThat(swapped.get("stops").get(3).get("refId").asString()).isEqualTo(extraCafe);
  }

  @Test
  void shareWithMatchCopyAndSaveMemories() throws Exception {
    UUID a = enabled();
    UUID b = enabled();
    UUID stranger = enabled();
    String matchId = matchUp(a, b);
    String plan = id(postAs(a, "/api/v1/plans", planJson("Hẹn đầu", "18:30", null)));
    postAs(a, "/api/v1/plans/" + plan + "/stops", stop("place", cafe, null));

    // Rủ đi: tin nhắn kèm plan; người kia xem được (chỉ đọc), người ngoài thì không
    postAs(stranger, "/api/v1/plans/" + plan + "/share", "{\"matchId\": \"%s\"}".formatted(matchId)).andExpect(status().isNotFound());
    JsonNode msg = body(postAs(a, "/api/v1/plans/" + plan + "/share", "{\"matchId\": \"%s\"}".formatted(matchId)).andExpect(status().isCreated()));
    assertThat(msg.get("plan").get("title").asString()).isEqualTo("Hẹn đầu");
    getAs(b, "/api/v1/dating/matches/" + matchId + "/messages")
        .andExpect(jsonPath("$[0].plan.id").value(plan))
        .andExpect(jsonPath("$[0].plan.stopCount").value(1));
    getAs(b, "/api/v1/plans/" + plan).andExpect(status().isOk()).andExpect(jsonPath("$.mine").value(false));
    postAs(b, "/api/v1/plans/" + plan + "/stops", stop("place", bar, null)).andExpect(status().isNotFound());
    getAs(stranger, "/api/v1/plans/" + plan).andExpect(status().isNotFound());

    // Người được rủ chép về làm plan của mình
    JsonNode copy = body(postAs(b, "/api/v1/plans/" + plan + "/copy", "{}").andExpect(status().isCreated()));
    assertThat(copy.get("mine").asBoolean()).isTrue();
    assertThat(names(copy)).containsExactly("Cafe Giảng");

    // Sau buổi hẹn: chấm điểm, ghi kỷ niệm, đã đi
    String stopId = stopIds(body(getAs(a, "/api/v1/plans/" + plan))).getFirst();
    patchJson(a, "/api/v1/plans/" + plan + "/stops/" + stopId, "{\"rating\": 5, \"memory\": \"Cà phê trứng ngon\"}");
    putJson(a, "/api/v1/plans/" + plan + "/status", "{\"status\": \"done\"}").andExpect(jsonPath("$.status").value("done"));

    // Lưu vào Người yêu: chỉ admin (guest 403); quán vào My place và được gắn kèm kỷ niệm
    UUID guest = newGuestOf(admin);
    String gf = id(postAs(admin, "/api/v1/girlfriends", "{\"name\": \"Lan\", \"status\": \"dating\", \"hobbies\": []}"));
    postAs(guest, "/api/v1/plans/" + plan + "/save-to-girlfriend", "{\"girlfriendId\": \"%s\"}".formatted(gf)).andExpect(status().isForbidden());
    String adminPlan = id(postAs(admin, "/api/v1/plans", planJson("Đi với Lan", "18:00", null)));
    postAs(admin, "/api/v1/plans/" + adminPlan + "/stops", stop("place", cafe, null));
    postAs(admin, "/api/v1/plans/" + adminPlan + "/stops", stop("spot", workshop, null));
    String adminStop = stopIds(body(getAs(admin, "/api/v1/plans/" + adminPlan))).getFirst();
    patchJson(admin, "/api/v1/plans/" + adminPlan + "/stops/" + adminStop, "{\"rating\": 5, \"memory\": \"Lần đầu đi cafe\"}");
    postAs(admin, "/api/v1/plans/" + adminPlan + "/save-to-girlfriend", "{\"girlfriendId\": \"%s\"}".formatted(gf))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.linked").value(1))
        .andExpect(jsonPath("$.skipped").value(1));
    assertThat(jdbc.queryForObject(
            "select l.memory from place_links l join places p on p.id = l.place_id where l.girlfriend_id = ?::uuid and p.catalog_id = ?::uuid",
            String.class, gf, cafe))
        .isEqualTo("Lần đầu đi cafe");
    // Lưu lại lần nữa không tạo trùng
    postAs(admin, "/api/v1/plans/" + adminPlan + "/save-to-girlfriend", "{\"girlfriendId\": \"%s\"}".formatted(gf)).andExpect(status().isOk());
    assertThat(jdbc.queryForObject("select count(*) from place_links where girlfriend_id = ?::uuid", Long.class, gf)).isEqualTo(1);
    // Quán đã vào My place của admin: hộp chọn điểm (tab My place) lọc được bằng mine=true
    getAs(admin, "/api/v1/catalog?mine=true").andExpect(jsonPath("$.total").value(1)).andExpect(jsonPath("$.items[0].id").value(cafe));
  }

  // ---- Helpers ----

  private static List<String> names(JsonNode plan) {
    List<String> out = new ArrayList<>();
    plan.get("stops").forEach(s -> out.add(s.get("name").asString()));
    return out;
  }

  private static List<String> categories(JsonNode plan) {
    List<String> out = new ArrayList<>();
    plan.get("stops").forEach(s -> out.add(s.get("category").asString()));
    return out;
  }

  private static List<String> stopIds(JsonNode plan) {
    List<String> out = new ArrayList<>();
    plan.get("stops").forEach(s -> out.add(s.get("id").asString()));
    return out;
  }

  private String id(ResultActions created) throws Exception {
    return body(created.andExpect(status().is2xxSuccessful())).get("id").asString();
  }

  private ResultActions putJson(UUID user, String path, String json) throws Exception {
    return mvc.perform(put(path).header(HttpHeaders.AUTHORIZATION, bearer(user)).contentType(MediaType.APPLICATION_JSON).content(json));
  }

  private ResultActions patchJson(UUID user, String path, String json) throws Exception {
    return mvc.perform(patch(path).header(HttpHeaders.AUTHORIZATION, bearer(user)).contentType(MediaType.APPLICATION_JSON).content(json));
  }

  private static String planJson(String title, String start, Long version) {
    return "{\"title\": \"%s\", \"startTime\": \"%s\", \"district\": \"HOAN_KIEM\", \"version\": %s}".formatted(title, start, version);
  }

  private static String stop(String kind, String refId, Integer minutes) {
    return "{\"kind\": \"%s\", \"refId\": \"%s\", \"durationMin\": %s}".formatted(kind, refId, minutes);
  }

  private static String place(String type, String name, double lat, double lng) {
    return """
        {"type": "%s", "district": "HOAN_KIEM", "name": "%s", "priceRange": "medium", "rating": 4,
         "openTime": "07:00", "closeTime": "23:59", "lat": %s, "lng": %s}
        """
        .formatted(type, name, lat, lng);
  }

  private static String spot(String name) {
    return """
        {"category": "workshop", "district": "HOAN_KIEM", "name": "%s", "priceFrom": 250000, "durationMin": 120,
         "indoor": true}
        """
        .formatted(name);
  }

  private String matchUp(UUID a, UUID b) throws Exception {
    postAs(a, "/api/v1/dating/swipes", "{\"targetId\": \"%s\", \"liked\": true}".formatted(b));
    return body(postAs(b, "/api/v1/dating/swipes", "{\"targetId\": \"%s\", \"liked\": true}".formatted(a))).get("match").get("id").asString();
  }

  private UUID enabled() {
    UUID id = newUser();
    jdbc.update(
        """
        insert into user_profiles (user_id, avatar_url, birthday, gender, city, bio, completed_at,
                                   created_at, updated_at, version, dating_enabled)
        values (?, '/uploads/a.webp', ?, 'female', 'Hà Nội', '', now(), now(), now(), 0, true)
        """,
        id, LocalDate.now().minusYears(25));
    return id;
  }
}
