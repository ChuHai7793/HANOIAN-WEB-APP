package com.gfmaster.dating;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.JsonNode;

/**
 * Hợp gu theo quán cùng lưu ("Cùng lưu", "Hợp gu %", "người hợp gu đã lưu"), "hôm nay đã thích" và siêu
 * thích (1 lượt/ngày theo giờ Việt Nam).
 */
class DatingFitIT extends ApiTestSupport {

  @Autowired JdbcTemplate jdbc;

  private UUID admin;
  private final List<String> cafes = new ArrayList<>();

  @BeforeEach
  void setUp() throws Exception {
    // Hồ sơ hẹn hò và quán của test khác không lọt vào test này
    jdbc.update("update user_profiles set dating_enabled = false");
    jdbc.update("delete from place_catalog");
    admin = newUser();
    cafes.clear();
    for (int i = 0; i < 5; i++) {
      cafes.add(
          body(postAs(admin, "/api/v1/admin/catalog", cafe("Cafe " + i)).andExpect(status().isCreated()))
              .get("id")
              .asString());
    }
  }

  @Test
  void sharedPlacesAndFitShowOnlyTheIntersection() throws Exception {
    UUID me = enabled("male", "female");
    UUID lan = enabled("female", "male");
    UUID mai = enabled("female", "male");
    save(me, 0, 1, 2, 3);
    save(lan, 0, 1, 2, 4); // 3 quán chung / min(4, 4) = 75%
    save(mai, 4); // không quán chung (quán 4 chỉ mai và lan lưu)

    JsonNode deck = body(getAs(me, "/api/v1/dating/deck"));
    assertThat(deck).hasSize(2);
    // Hợp gu cao hơn lên trước
    JsonNode first = deck.get(0);
    assertThat(first.get("userId").asString()).isEqualTo(lan.toString());
    assertThat(first.get("fit").asInt()).isEqualTo(75);
    assertThat(names(first.get("sharedPlaces"))).containsExactlyInAnyOrder("Cafe 0", "Cafe 1", "Cafe 2");
    // Không lộ quán chỉ một bên lưu
    assertThat(names(first.get("sharedPlaces"))).doesNotContain("Cafe 3", "Cafe 4");
    assertThat(first.get("sharedPlaces").get(0).get("district").asString()).isEqualTo("Hoàn Kiếm");
    assertThat(deck.get(1).get("fit").asInt()).isZero();
    assertThat(deck.get(1).get("sharedPlaces")).isEmpty();

    // Match: thẻ người kia cũng có quán cùng lưu, nhìn từ phía mỗi bên
    swipe(lan, me, true, false);
    swipe(me, lan, true, false).andExpect(jsonPath("$.match.user.fit").value(75));
    getAs(lan, "/api/v1/dating/matches")
        .andExpect(jsonPath("$[0].user.userId").value(me.toString()))
        .andExpect(jsonPath("$[0].user.sharedPlaces", hasSize(3)));
  }

  @Test
  void peopleWhoLikedMeStayAheadOfBetterFit() throws Exception {
    UUID me = enabled("male", "female");
    UUID fan = enabled("female", "male");
    UUID twin = enabled("female", "male");
    save(me, 0, 1, 2);
    save(twin, 0, 1, 2);
    swipe(fan, me, true, false);

    assertThat(ids(getAs(me, "/api/v1/dating/deck"))).containsExactly(fan.toString(), twin.toString());
  }

  @Test
  void catalogCountsFansOnlyAmongPeopleIWouldSee() throws Exception {
    UUID me = enabled("male", "female");
    UUID lan = enabled("female", "male");
    UUID wrongGender = enabled("male", "all");
    UUID blocked = enabled("female", "male");
    UUID off = enabled("female", "male");
    for (UUID u : List.of(me, lan, wrongGender, blocked, off)) save(u, 0);
    postAs(me, "/api/v1/dating/blocks", "{\"userId\": \"%s\"}".formatted(blocked)).andExpect(status().isNoContent());
    jdbc.update("update user_profiles set dating_enabled = false where user_id = ?", off);

    JsonNode items = body(getAs(me, "/api/v1/catalog?size=10")).get("items");
    for (JsonNode item : items) {
      int expected = item.get("id").asString().equals(cafes.get(0)) ? 1 : 0;
      assertThat(item.get("fans").asInt()).as(item.get("name").asString()).isEqualTo(expected);
    }

    // Người xem chưa bật Tìm đối tượng: không có số
    UUID outsider = newUser();
    assertThat(body(getAs(outsider, "/api/v1/catalog?size=1")).get("items").get(0).get("fans").isNull()).isTrue();
  }

  @Test
  void oneSuperLikePerDayAndItPutsMeOnTopOfTheirDeck() throws Exception {
    UUID me = enabled("male", "female");
    UUID lan = enabled("female", "male");
    UUID mai = enabled("female", "male");
    UUID other = enabled("male", "female"); // lan và mai cũng thấy người này
    save(other, 0);
    save(lan, 0);

    getAs(me, "/api/v1/dating/today").andExpect(jsonPath("$.liked").value(0)).andExpect(jsonPath("$.superLikesLeft").value(1));

    swipe(me, lan, true, true).andExpect(status().isOk()).andExpect(jsonPath("$.matched").value(false));
    swipe(me, mai, true, true).andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.code").value("SUPER_LIKE_LIMIT"));
    getAs(me, "/api/v1/dating/today").andExpect(jsonPath("$.liked").value(1)).andExpect(jsonPath("$.superLikesLeft").value(0));

    // Lan thấy mình đầu tiên, có cờ siêu thích, dù "other" hợp gu hơn
    JsonNode lanDeck = body(getAs(lan, "/api/v1/dating/deck"));
    assertThat(lanDeck.get(0).get("userId").asString()).isEqualTo(me.toString());
    assertThat(lanDeck.get(0).get("superLikedMe").asBoolean()).isTrue();
    assertThat(lanDeck.get(1).get("superLikedMe").asBoolean()).isFalse();

    // Hoàn tác hoàn lại lượt
    deleteAs(me, "/api/v1/dating/swipes/last").andExpect(status().isOk());
    getAs(me, "/api/v1/dating/today").andExpect(jsonPath("$.liked").value(0)).andExpect(jsonPath("$.superLikesLeft").value(1));

    // Lượt hôm qua (giờ Việt Nam) không tính vào hôm nay
    swipe(me, lan, true, true).andExpect(status().isOk());
    jdbc.update("update swipes set created_at = created_at - interval '1 day' where swiper_id = ?", me);
    getAs(me, "/api/v1/dating/today").andExpect(jsonPath("$.liked").value(0)).andExpect(jsonPath("$.superLikesLeft").value(1));
    swipe(me, mai, true, true).andExpect(status().isOk());

    // Siêu thích mà không thích: 400
    UUID third = enabled("female", "male");
    swipe(me, third, false, true).andExpect(status().isBadRequest());
  }

  // ---- Helpers ----

  private UUID enabled(String gender, String interestedIn) {
    UUID id = newUser();
    jdbc.update(
        """
        insert into user_profiles (user_id, avatar_url, birthday, gender, city, bio, completed_at,
                                   created_at, updated_at, version, dating_enabled, interested_in)
        values (?, '/uploads/a.webp', ?, ?, 'Hà Nội', '', now(), now(), now(), 0, true, ?)
        """,
        id, LocalDate.now().minusYears(25), gender, interestedIn);
    return id;
  }

  /** Lưu các quán (theo chỉ số trong {@link #cafes}) vào My place của user. */
  private void save(UUID user, int... index) throws Exception {
    for (int i : index) postAs(user, "/api/v1/catalog/" + cafes.get(i) + "/my-place", "").andExpect(status().isCreated());
  }

  private ResultActions swipe(UUID from, UUID to, boolean liked, boolean superLike) throws Exception {
    return postAs(
        from,
        "/api/v1/dating/swipes",
        "{\"targetId\": \"%s\", \"liked\": %s, \"superLike\": %s}".formatted(to, liked, superLike));
  }

  private List<String> ids(ResultActions deck) throws Exception {
    List<String> out = new ArrayList<>();
    for (JsonNode c : body(deck)) out.add(c.get("userId").asString());
    return out;
  }

  private static List<String> names(JsonNode places) {
    List<String> out = new ArrayList<>();
    for (JsonNode p : places) out.add(p.get("name").asString());
    return out;
  }

  private static String cafe(String name) {
    return """
        {"type": "cafe", "district": "HOAN_KIEM", "name": "%s", "priceRange": "medium", "rating": 4,
         "openTime": "07:00", "closeTime": "22:00"}
        """
        .formatted(name);
  }
}
