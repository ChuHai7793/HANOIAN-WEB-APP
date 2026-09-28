package com.gfmaster.common.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gfmaster.support.ApiTestSupport;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.JsonNode;

class IdempotencyIT extends ApiTestSupport {

  private static final String CAFE =
      """
      {"type": "cafe", "name": "Một lần thôi", "priceRange": "cheap", "rating": 3,
       "openTime": "07:00", "closeTime": "21:00"}
      """;

  @Autowired JdbcTemplate jdbc;
  @Autowired StringRedisTemplate redis;

  @Test
  void retryWithSameKeyReplaysOriginalResponse() throws Exception {
    UUID user = newUser();
    String key = UUID.randomUUID().toString();

    JsonNode first =
        body(
            postWithKey(user, "/api/v1/places", key, CAFE)
                .andExpect(status().isCreated())
                .andExpect(header().doesNotExist(IdempotencyFilter.REPLAYED_HEADER)));

    postWithKey(user, "/api/v1/places", key, CAFE)
        .andExpect(status().isCreated())
        .andExpect(header().string(IdempotencyFilter.REPLAYED_HEADER, "true"))
        .andExpect(header().string(HttpHeaders.LOCATION, "/api/v1/places/" + first.get("id").asString()))
        .andExpect(jsonPath("$.id").value(first.get("id").asString()))
        .andExpect(jsonPath("$.name").value("Một lần thôi"));

    assertThat(countPlaces(user)).isEqualTo(1);
    assertThat(redis.getExpire("idem:" + user + ":" + key)).isGreaterThan(3600);
  }

  @Test
  void differentKeysCreateSeparateRecords() throws Exception {
    UUID user = newUser();
    postWithKey(user, "/api/v1/places", UUID.randomUUID().toString(), CAFE).andExpect(status().isCreated());
    postWithKey(user, "/api/v1/places", UUID.randomUUID().toString(), CAFE).andExpect(status().isCreated());
    assertThat(countPlaces(user)).isEqualTo(2);
  }

  @Test
  void withoutHeaderRequestIsNotDeduplicated() throws Exception {
    UUID user = newUser();
    postAs(user, "/api/v1/places", CAFE).andExpect(status().isCreated());
    postAs(user, "/api/v1/places", CAFE).andExpect(status().isCreated());
    assertThat(countPlaces(user)).isEqualTo(2);
  }

  @Test
  void keysAreScopedPerUser() throws Exception {
    UUID alice = newUser();
    UUID bob = newUser();
    String key = UUID.randomUUID().toString();

    String aliceId = body(postWithKey(alice, "/api/v1/places", key, CAFE).andExpect(status().isCreated())).get("id").asString();
    postWithKey(bob, "/api/v1/places", key, CAFE)
        .andExpect(status().isCreated())
        .andExpect(header().doesNotExist(IdempotencyFilter.REPLAYED_HEADER))
        .andExpect(jsonPath("$.id").value(not(aliceId)));
  }

  @Test
  void sameKeyOnAnotherEndpointIsRejected() throws Exception {
    UUID user = newUser();
    String key = UUID.randomUUID().toString();
    postWithKey(user, "/api/v1/places", key, CAFE).andExpect(status().isCreated());

    String gf = "{\"name\": \"Lan\", \"status\": \"dating\"}";
    postWithKey(user, "/api/v1/girlfriends", key, gf)
        .andExpect(status().isUnprocessableContent())
        .andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_REUSED"));
  }

  @Test
  void clientErrorIsReplayedToo() throws Exception {
    UUID user = newUser();
    String key = UUID.randomUUID().toString();
    String invalid = CAFE.replace("Một lần thôi", "");

    postWithKey(user, "/api/v1/places", key, invalid).andExpect(status().isBadRequest());
    postWithKey(user, "/api/v1/places", key, invalid)
        .andExpect(status().isBadRequest())
        .andExpect(header().string(IdempotencyFilter.REPLAYED_HEADER, "true"))
        .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
  }

  @Test
  void malformedKeyIsRejected() throws Exception {
    UUID user = newUser();
    postWithKey(user, "/api/v1/places", "short", CAFE)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
    postWithKey(user, "/api/v1/places", "có dấu cách và tiếng Việt", CAFE).andExpect(status().isBadRequest());
    assertThat(countPlaces(user)).isZero();
  }

  @Test
  void unauthenticatedRequestIsNotStored() throws Exception {
    String key = UUID.randomUUID().toString();
    mvc.perform(
            post("/api/v1/places")
                .header("Idempotency-Key", key)
                .contentType(MediaType.APPLICATION_JSON)
                .content(CAFE))
        .andExpect(status().isUnauthorized());
    assertThat(redis.keys("idem:*:" + key)).isEmpty();
  }

  private ResultActions postWithKey(UUID user, String path, String key, String body) throws Exception {
    return mvc.perform(
        post(path)
            .header(HttpHeaders.AUTHORIZATION, bearer(user))
            .header("Idempotency-Key", key)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
  }

  private int countPlaces(UUID user) {
    return jdbc.queryForObject("select count(*) from places where user_id = ?", Integer.class, user.toString());
  }
}
