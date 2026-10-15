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

/** Bỏ match, chặn, báo cáo; admin: thống kê, báo cáo, hoạt động từng người, khoá/mở khoá. */
class DatingSafetyIT extends ApiTestSupport {

  @Autowired JdbcTemplate jdbc;

  @BeforeEach
  void onlyThisTestsProfilesAreVisible() {
    jdbc.update("update user_profiles set dating_enabled = false");
  }

  @Test
  void blockHidesBothWaysAndRemovesTheMatch() throws Exception {
    UUID a = enabled(25);
    UUID b = enabled(26);
    matchUp(a, b);

    postAs(a, "/api/v1/dating/blocks", "{\"userId\": \"%s\"}".formatted(b)).andExpect(status().isNoContent());
    getAs(a, "/api/v1/dating/matches").andExpect(jsonPath("$", hasSize(0)));
    getAs(b, "/api/v1/dating/matches").andExpect(jsonPath("$", hasSize(0)));
    // Xoá lượt quẹt để chắc chắn ẩn là do chặn
    jdbc.update("delete from swipes where swiper_id in (?, ?)", a, b);
    assertThat(ids(getAs(a, "/api/v1/dating/deck"))).doesNotContain(b.toString());
    assertThat(ids(getAs(b, "/api/v1/dating/deck"))).doesNotContain(a.toString());
    swipe(b, a, true).andExpect(status().isNotFound());
  }

  @Test
  void unmatchOnlyByParticipants() throws Exception {
    UUID a = enabled(25);
    UUID b = enabled(26);
    UUID stranger = enabled(27);
    String matchId = matchUp(a, b);

    deleteAs(stranger, "/api/v1/dating/matches/" + matchId).andExpect(status().isNotFound());
    deleteAs(a, "/api/v1/dating/matches/" + matchId).andExpect(status().isNoContent());
    getAs(b, "/api/v1/dating/matches").andExpect(jsonPath("$", hasSize(0)));
    // Bỏ match không làm hai người hiện lại với nhau
    assertThat(ids(getAs(a, "/api/v1/dating/deck"))).doesNotContain(b.toString());
  }

  @Test
  void reportsReachAdminAndBanWorks() throws Exception {
    UUID admin = newUser();
    UUID reporter = enabled(25);
    UUID bad = enabled(30);
    UUID guest = newGuestOf(admin);
    swipe(bad, reporter, true);

    postAs(reporter, "/api/v1/dating/reports", "{\"userId\": \"%s\", \"reason\": \"harassment\", \"note\": \"Nhắn tin khiếm nhã\", \"block\": true}".formatted(bad))
        .andExpect(status().isCreated());
    postAs(reporter, "/api/v1/dating/reports", "{\"userId\": \"%s\", \"reason\": \"khong_co\"}".formatted(bad))
        .andExpect(status().isBadRequest());

    // Chỉ admin xem được
    getAs(guest, "/api/v1/admin/dating/reports").andExpect(status().isForbidden());
    JsonNode reports = body(getAs(admin, "/api/v1/admin/dating/reports").andExpect(status().isOk()));
    JsonNode report = null;
    for (JsonNode r : reports) if (r.get("reported").get("id").asString().equals(bad.toString())) report = r;
    assertThat(report).isNotNull();
    assertThat(report.get("reason").asString()).isEqualTo("harassment");
    assertThat(report.get("reporter").get("id").asString()).isEqualTo(reporter.toString());

    // Hoạt động của người bị báo cáo: đã thích reporter, bị báo cáo 1 lần
    JsonNode activity = body(getAs(admin, "/api/v1/admin/dating/users/" + bad).andExpect(status().isOk()));
    assertThat(activity.get("summary").get("reportsAgainst").asLong()).isEqualTo(1);
    assertThat(activity.get("likesGiven").get(0).get("user").get("id").asString()).isEqualTo(reporter.toString());
    getAs(admin, "/api/v1/admin/dating/stats").andExpect(status().isOk()).andExpect(jsonPath("$.openReports").isNumber());
    // Trang chi tiết: trạng thái, hồ sơ đầy đủ và các báo cáo về người này
    assertThat(activity.get("summary").get("status").asString()).isEqualTo("ON");
    assertThat(activity.get("detail").get("gender").asString()).isEqualTo("female");
    assertThat(activity.get("detail").get("missing")).isEmpty();
    assertThat(activity.get("reports").get(0).get("reason").asString()).isEqualTo("harassment");

    // Xử lý báo cáo
    putJson(admin, "/api/v1/admin/dating/reports/" + report.get("id").asString(), "{\"status\": \"RESOLVED\"}")
        .andExpect(status().isNoContent());
    getAs(admin, "/api/v1/admin/dating/reports?status=RESOLVED").andExpect(jsonPath("$[?(@.id == '%s')]".formatted(report.get("id").asString())).exists());

    // Khoá: người bị khoá không quẹt được, không hiện với ai, không tự bật lại được
    putJson(admin, "/api/v1/admin/dating/users/" + bad + "/ban", "{\"banned\": true}").andExpect(status().isNoContent());
    getAs(bad, "/api/v1/dating/deck").andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("DATING_BANNED"));
    getAs(bad, "/api/v1/dating/settings").andExpect(jsonPath("$.banned").value(true)).andExpect(jsonPath("$.enabled").value(false));
    putJson(bad, "/api/v1/dating/settings", "{\"enabled\": true, \"interestedIn\": \"all\", \"ageMin\": 18, \"ageMax\": 99, \"sameCityOnly\": false}")
        .andExpect(status().isForbidden());
    UUID other = enabled(28);
    assertThat(ids(getAs(other, "/api/v1/dating/deck"))).doesNotContain(bad.toString());

    // Mở khoá: tự bật lại được
    putJson(admin, "/api/v1/admin/dating/users/" + bad + "/ban", "{\"banned\": false}").andExpect(status().isNoContent());
    putJson(bad, "/api/v1/dating/settings", "{\"enabled\": true, \"interestedIn\": \"all\", \"ageMin\": 18, \"ageMax\": 99, \"sameCityOnly\": false}")
        .andExpect(status().isOk());
    putJson(guest, "/api/v1/admin/dating/users/" + bad + "/ban", "{\"banned\": true}").andExpect(status().isForbidden());
  }

  // ---- Helpers ----

  private String matchUp(UUID a, UUID b) throws Exception {
    swipe(a, b, true).andExpect(jsonPath("$.matched").value(false));
    return body(swipe(b, a, true).andExpect(jsonPath("$.matched").value(true))).get("match").get("id").asString();
  }

  @Test
  void adminSeesEveryAccountWithItsDatingStatus() throws Exception {
    UUID admin = newUser();
    UUID fresh = newUser(); // vừa đăng ký, chưa có dòng hồ sơ
    UUID noPhoto = newUser();
    jdbc.update(
        """
        insert into user_profiles (user_id, birthday, gender, city, bio, created_at, updated_at, version)
        values (?, ?, 'male', 'Hà Nội', '', now(), now(), 0)
        """,
        noPhoto, LocalDate.now().minusYears(25));
    UUID on = enabled(22);

    JsonNode rows = body(getAs(admin, "/api/v1/admin/dating/users").andExpect(status().isOk()));
    java.util.Map<String, String> status = new java.util.HashMap<>();
    for (JsonNode r : rows) status.put(r.get("user").get("id").asString(), r.get("status").asString());
    assertThat(status).containsEntry(fresh.toString(), "NO_PROFILE");
    assertThat(status).containsEntry(noPhoto.toString(), "INCOMPLETE");
    assertThat(status).containsEntry(on.toString(), "ON");

    // Chi tiết người chưa có hồ sơ: thiếu cả ảnh lẫn ngày sinh, chưa lưu gì
    JsonNode fresh1 = body(getAs(admin, "/api/v1/admin/dating/users/" + fresh).andExpect(status().isOk()));
    assertThat(fresh1.get("detail").get("missing")).hasSize(2);
    assertThat(fresh1.get("detail").get("savedPlaces").asLong()).isZero();
    assertThat(fresh1.get("summary").get("createdAt").isNull()).isFalse();
    getAs(admin, "/api/v1/admin/dating/users/" + UUID.randomUUID()).andExpect(status().isNotFound());

    JsonNode stats = body(getAs(admin, "/api/v1/admin/dating/stats"));
    assertThat(stats.get("totalUsers").asLong()).isGreaterThanOrEqualTo(4);
    assertThat(stats.get("noProfile").asLong()).isGreaterThanOrEqualTo(2);
    assertThat(stats.get("incompleteProfiles").asLong()).isGreaterThanOrEqualTo(1);
  }

  private UUID enabled(int age) {
    UUID id = newUser();
    jdbc.update(
        """
        insert into user_profiles (user_id, avatar_url, birthday, gender, city, bio, completed_at,
                                   created_at, updated_at, version, dating_enabled)
        values (?, '/uploads/a.webp', ?, 'female', 'Hà Nội', '', now(), now(), now(), 0, true)
        """,
        id, LocalDate.now().minusYears(age).minusDays(10));
    return id;
  }

  private ResultActions swipe(UUID from, UUID to, boolean liked) throws Exception {
    return postAs(from, "/api/v1/dating/swipes", "{\"targetId\": \"%s\", \"liked\": %s}".formatted(to, liked));
  }

  private ResultActions putJson(UUID user, String path, String body) throws Exception {
    return mvc.perform(
        put(path).header(HttpHeaders.AUTHORIZATION, bearer(user)).contentType(MediaType.APPLICATION_JSON).content(body));
  }

  private List<String> ids(ResultActions deck) throws Exception {
    List<String> out = new ArrayList<>();
    for (JsonNode c : body(deck)) out.add(c.get("userId").asString());
    return out;
  }
}
