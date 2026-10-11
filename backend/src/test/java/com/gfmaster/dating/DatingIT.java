package com.gfmaster.dating;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
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

/** "Tìm đối tượng": bật (cần ảnh, đủ 18 tuổi), thẻ để quẹt theo bộ lọc hai phía, match, hoàn tác. */
class DatingIT extends ApiTestSupport {

  @Autowired JdbcTemplate jdbc;

  @BeforeEach
  void onlyThisTestsProfilesAreVisible() {
    // Hồ sơ hẹn hò của test khác không lọt vào thẻ của test này
    jdbc.update("update user_profiles set dating_enabled = false");
  }

  @Test
  void enablingRequiresPhotoAndAdultAge() throws Exception {
    UUID noProfile = newUser();
    getAs(noProfile, "/api/v1/dating/settings")
        .andExpect(jsonPath("$.enabled").value(false))
        .andExpect(jsonPath("$.missing", hasSize(2)));
    putSettings(noProfile, true, "all", 18, 99, false)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("DATING_PROFILE_INCOMPLETE"));

    UUID teen = profile("female", LocalDate.now().minusYears(17), "Hà Nội", false);
    putSettings(teen, true, "all", 18, 99, false).andExpect(status().isBadRequest());

    UUID adult = profile("female", LocalDate.now().minusYears(20), "Hà Nội", false);
    putSettings(adult, true, "all", 18, 99, false)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.enabled").value(true))
        .andExpect(jsonPath("$.missing", hasSize(0)));
    putSettings(adult, true, "all", 30, 20, false).andExpect(status().isBadRequest());

    // Chưa bật thì không xem thẻ được
    getAs(noProfile, "/api/v1/dating/deck")
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("DATING_NOT_ENABLED"));
  }

  @Test
  void mutualLikeMakesAMatchAndSwipedPeopleLeaveTheDeck() throws Exception {
    UUID lan = enabled("female", 24, "Hà Nội", "male");
    UUID minh = enabled("male", 26, "Hà Nội", "female");
    UUID hidden = profile("male", LocalDate.now().minusYears(25), "Hà Nội", false); // không bật
    // Guest (tài khoản tự đăng ký) cũng dùng được
    UUID guest = newGuestOf(newUser());
    insertProfile(guest, "male", LocalDate.now().minusYears(30), "Hà Nội", true, "female");

    List<String> lanDeck = ids(getAs(lan, "/api/v1/dating/deck").andExpect(status().isOk()));
    assertThat(lanDeck).contains(minh.toString(), guest.toString()).doesNotContain(hidden.toString(), lan.toString());

    // Minh thích Lan: chưa match; Lan thấy Minh đứng đầu (người đã thích mình xếp trước)
    swipe(minh, lan, true).andExpect(jsonPath("$.matched").value(false));
    assertThat(ids(getAs(lan, "/api/v1/dating/deck")).getFirst()).isEqualTo(minh.toString());

    // Lan thích lại: match, kèm thẻ của Minh
    swipe(lan, minh, true)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.matched").value(true))
        .andExpect(jsonPath("$.match.user.userId").value(minh.toString()))
        .andExpect(jsonPath("$.match.user.age").value(26));
    getAs(lan, "/api/v1/dating/matches").andExpect(jsonPath("$", hasSize(1))).andExpect(jsonPath("$[0].user.displayName").value("Tester"));
    getAs(minh, "/api/v1/dating/matches").andExpect(jsonPath("$[0].user.userId").value(lan.toString()));

    // Đã quẹt thì không hiện lại, quẹt lần hai bị từ chối
    assertThat(ids(getAs(lan, "/api/v1/dating/deck"))).doesNotContain(minh.toString());
    swipe(lan, minh, false).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ALREADY_SWIPED"));

    // Không quẹt được chính mình hay người không bật
    swipe(lan, lan, true).andExpect(status().isNotFound());
    swipe(lan, hidden, true).andExpect(status().isNotFound());

    // Lượt thích đã tạo match thì không hoàn tác được
    deleteAs(lan, "/api/v1/dating/swipes/last")
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("CANNOT_UNDO_MATCH"));
  }

  @Test
  void undoBringsTheCardBack() throws Exception {
    UUID me = enabled("female", 25, "Hà Nội", "all");
    UUID other = enabled("male", 27, "Hà Nội", "all");
    deleteAs(me, "/api/v1/dating/swipes/last").andExpect(status().isNotFound());

    swipe(me, other, false).andExpect(jsonPath("$.matched").value(false));
    assertThat(ids(getAs(me, "/api/v1/dating/deck"))).doesNotContain(other.toString());
    deleteAs(me, "/api/v1/dating/swipes/last")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.restored.userId").value(other.toString()));
    assertThat(ids(getAs(me, "/api/v1/dating/deck"))).contains(other.toString());
  }

  @Test
  void filtersApplyOnBothSides() throws Exception {
    UUID me = enabled("male", 25, "Hà Nội", "female");
    UUID woman = enabled("female", 24, "Hà Nội", "male");
    UUID man = enabled("male", 24, "Hà Nội", "all");
    UUID womanWantsWomen = enabled("female", 24, "Hà Nội", "female");
    UUID older = enabled("female", 40, "Hà Nội", "all");
    UUID saigon = enabled("female", 24, "TP HCM", "all");

    List<String> deck = ids(getAs(me, "/api/v1/dating/deck"));
    assertThat(deck)
        .contains(woman.toString(), older.toString(), saigon.toString())
        .doesNotContain(man.toString(), womanWantsWomen.toString());

    putSettings(me, true, "female", 20, 30, true).andExpect(status().isOk());
    assertThat(ids(getAs(me, "/api/v1/dating/deck")))
        .contains(woman.toString())
        .doesNotContain(older.toString(), saigon.toString());

    // Phía kia đặt tuổi tối đa thấp hơn tuổi của mình: mình không hiện với họ, họ không hiện với mình
    putSettings(woman, true, "male", 18, 22, false).andExpect(status().isOk());
    assertThat(ids(getAs(me, "/api/v1/dating/deck"))).doesNotContain(woman.toString());
  }

  // ---- Helpers ----

  private UUID enabled(String gender, int age, String city, String interestedIn) {
    UUID id = newUser();
    insertProfile(id, gender, LocalDate.now().minusYears(age).minusDays(10), city, true, interestedIn);
    return id;
  }

  private UUID profile(String gender, LocalDate birthday, String city, boolean enabled) {
    UUID id = newUser();
    insertProfile(id, gender, birthday, city, enabled, "all");
    return id;
  }

  private void insertProfile(UUID user, String gender, LocalDate birthday, String city, boolean enabled, String interestedIn) {
    jdbc.update(
        """
        insert into user_profiles (user_id, avatar_url, birthday, gender, city, bio, completed_at,
                                   created_at, updated_at, version, dating_enabled, interested_in)
        values (?, '/uploads/a.webp', ?, ?, ?, '', now(), now(), now(), 0, ?, ?)
        """,
        user, birthday, gender, city, enabled, interestedIn);
  }

  private ResultActions putSettings(UUID user, boolean enabled, String interestedIn, int ageMin, int ageMax, boolean sameCity)
      throws Exception {
    return mvc.perform(
        put("/api/v1/dating/settings")
            .header(HttpHeaders.AUTHORIZATION, bearer(user))
            .contentType(MediaType.APPLICATION_JSON)
            .content(
                "{\"enabled\": %s, \"interestedIn\": \"%s\", \"ageMin\": %d, \"ageMax\": %d, \"sameCityOnly\": %s}"
                    .formatted(enabled, interestedIn, ageMin, ageMax, sameCity)));
  }

  private ResultActions swipe(UUID from, UUID to, boolean liked) throws Exception {
    return postAs(from, "/api/v1/dating/swipes", "{\"targetId\": \"%s\", \"liked\": %s}".formatted(to, liked));
  }

  private List<String> ids(ResultActions deck) throws Exception {
    List<String> out = new ArrayList<>();
    for (JsonNode c : body(deck)) out.add(c.get("userId").asString());
    return out;
  }
}
