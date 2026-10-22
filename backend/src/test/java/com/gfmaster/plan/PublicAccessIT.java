package com.gfmaster.plan;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gfmaster.support.ApiTestSupport;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.JsonNode;

/** Khách chưa đăng nhập: xem danh mục, thử Autoplan (không lưu), xem plan công khai; quiz gu hẹn hò. */
class PublicAccessIT extends ApiTestSupport {

  @Autowired JdbcTemplate jdbc;

  @Test
  void guestsBrowseCatalogAndSpotsButCannotWrite() throws Exception {
    UUID admin = newUser();
    postAs(admin, "/api/v1/admin/catalog", place("cafe", "Cafe khách xem")).andExpect(status().isCreated());

    mvc.perform(get("/api/v1/catalog?q=khách xem"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].inMyPlace").value(false))
        .andExpect(jsonPath("$.items[0].fans").doesNotExist());
    mvc.perform(get("/api/v1/catalog/counts")).andExpect(status().isOk());
    mvc.perform(get("/api/v1/catalog/districts")).andExpect(status().isOk());
    mvc.perform(get("/api/v1/spots")).andExpect(status().isOk());
    mvc.perform(get("/api/v1/spots/counts")).andExpect(status().isOk());
    // Con số trang chủ: công khai, chưa có đánh giá thì ratingAvg null
    mvc.perform(get("/api/v1/public/stats"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.places").isNumber())
        .andExpect(jsonPath("$.spots").isNumber())
        .andExpect(jsonPath("$.reviews").isNumber())
        .andExpect(jsonPath("$.plans").isNumber());

    // Phần còn lại vẫn phải đăng nhập
    mvc.perform(get("/api/v1/places")).andExpect(status().isUnauthorized());
    mvc.perform(get("/api/v1/plans")).andExpect(status().isUnauthorized());
    mvc.perform(post("/api/v1/catalog/" + UUID.randomUUID() + "/my-place")).andExpect(status().isUnauthorized());
  }

  @Test
  void guestAutoplanIsNotSaved() throws Exception {
    UUID admin = newUser();
    postAs(admin, "/api/v1/admin/catalog", place("restaurant", "Quán ăn cho khách")).andExpect(status().isCreated());
    postAs(admin, "/api/v1/admin/catalog", place("cafe", "Cafe cho khách")).andExpect(status().isCreated());
    Long before = jdbc.queryForObject("select count(*) from plans", Long.class);

    JsonNode result =
        body(
            mvc.perform(post("/api/v1/public/autoplan").contentType(MediaType.APPLICATION_JSON).content("{\"district\": \"TAY_HO\", \"slot\": \"evening\"}"))
                .andExpect(status().isOk()));
    JsonNode plan = result.get("plan");
    assertThat(plan.get("id").isNull()).isTrue();
    assertThat(plan.get("mine").asBoolean()).isFalse();
    assertThat(plan.get("stops").size()).isGreaterThan(0);
    assertThat(plan.get("stops").get(0).get("arrival").asString()).isEqualTo("18:00");
    assertThat(jdbc.queryForObject("select count(*) from plans", Long.class)).isEqualTo(before);
  }

  @Test
  void publicLinkShowsPlanWithoutPrivateBitsAndCanBeRevoked() throws Exception {
    UUID admin = newUser();
    String cafe = body(postAs(admin, "/api/v1/admin/catalog", place("cafe", "Cafe chia sẻ"))).get("id").asString();
    UUID owner = newUser();
    UUID other = newUser();
    String plan = body(postAs(owner, "/api/v1/plans", "{\"title\": \"Hẹn cuối tuần\", \"startTime\": \"19:00\"}")).get("id").asString();
    String stopId = body(postAs(owner, "/api/v1/plans/" + plan + "/stops", "{\"kind\": \"place\", \"refId\": \"%s\"}".formatted(cafe)))
        .get("stops").get(0).get("id").asString();
    mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch("/api/v1/plans/" + plan + "/stops/" + stopId)
        .header(HttpHeaders.AUTHORIZATION, bearer(owner)).contentType(MediaType.APPLICATION_JSON).content("{\"rating\": 5, \"memory\": \"Bí mật\"}"));

    // Chỉ chủ plan bật được link; bật lại vẫn giữ mã cũ
    postAs(other, "/api/v1/plans/" + plan + "/public-link", "{}").andExpect(status().isNotFound());
    String token = body(postAs(owner, "/api/v1/plans/" + plan + "/public-link", "{}").andExpect(status().isOk())).get("token").asString();
    assertThat(body(postAs(owner, "/api/v1/plans/" + plan + "/public-link", "{}")).get("token").asString()).isEqualTo(token);
    getAs(owner, "/api/v1/plans/" + plan).andExpect(jsonPath("$.shareToken").value(token));

    // Khách xem được, không thấy kỷ niệm / điểm chấm / mã chia sẻ
    mvc.perform(get("/api/v1/public/plans/" + token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.title").value("Hẹn cuối tuần"))
        .andExpect(jsonPath("$.mine").value(false))
        .andExpect(jsonPath("$.shareToken").doesNotExist())
        .andExpect(jsonPath("$.stops[0].memory").value(""))
        .andExpect(jsonPath("$.stops[0].rating").doesNotExist());

    // Người khác chép về làm plan của mình
    postAs(other, "/api/v1/plans/public/" + token + "/copy", "{}").andExpect(status().isCreated()).andExpect(jsonPath("$.mine").value(true));

    // Tắt link: hết xem được
    deleteAs(owner, "/api/v1/plans/" + plan + "/public-link").andExpect(status().isNoContent());
    mvc.perform(get("/api/v1/public/plans/" + token)).andExpect(status().isNotFound());
  }

  @Test
  void dateVibeQuizResult() throws Exception {
    UUID me = newUser();
    getAs(me, "/api/v1/me/vibe").andExpect(jsonPath("$.vibe").doesNotExist());
    mvc.perform(put("/api/v1/me/vibe").header(HttpHeaders.AUTHORIZATION, bearer(me)).contentType(MediaType.APPLICATION_JSON).content("{\"vibe\": \"romantic\"}"))
        .andExpect(status().isNoContent());
    getAs(me, "/api/v1/me/vibe").andExpect(jsonPath("$.vibe").value("romantic"));
    mvc.perform(put("/api/v1/me/vibe").header(HttpHeaders.AUTHORIZATION, bearer(me)).contentType(MediaType.APPLICATION_JSON).content("{\"vibe\": \"sleepy\"}"))
        .andExpect(status().isBadRequest());
    mvc.perform(get("/api/v1/me/vibe")).andExpect(status().isUnauthorized());
  }

  private static String place(String type, String name) {
    return """
        {"type": "%s", "district": "TAY_HO", "name": "%s", "priceRange": "medium", "rating": 4,
         "openTime": "07:00", "closeTime": "23:59"}
        """
        .formatted(type, name);
  }
}
