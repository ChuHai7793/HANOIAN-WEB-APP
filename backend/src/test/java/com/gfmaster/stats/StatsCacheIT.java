package com.gfmaster.stats;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gfmaster.support.ApiTestSupport;
import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;

class StatsCacheIT extends ApiTestSupport {

  private static final Duration WAIT = Duration.ofSeconds(15);

  @Autowired JdbcTemplate jdbc;
  @Autowired StringRedisTemplate redis;

  @Test
  void statsAreCachedInRedisAndEvictedByEvents() throws Exception {
    UUID user = newUser();
    String cacheKey = "cache:stats::" + user;
    String placeId = createPlace(user, "cafe", "Quán A").get("id").asString();

    // place.created đã xoá cache (nếu có); lần GET này tính lại và lưu vào Redis
    getAs(user, "/api/v1/stats").andExpect(status().isOk()).andExpect(jsonPath("$.cafes").value(1));
    assertThat(redis.getExpire(cacheKey)).isBetween(1L, 600L);
    assertThat(redis.opsForValue().get(cacheKey)).contains("\"cafes\":1").doesNotContain("@class");

    // Sửa thẳng DB, không qua service (không có event): /stats vẫn trả số cũ từ cache
    jdbc.update("update places set type = 'bar' where id = ?", placeId);
    getAs(user, "/api/v1/stats").andExpect(jsonPath("$.cafes").value(1)).andExpect(jsonPath("$.bars").value(0));

    // Sửa qua API: place.updated → queue gfm.cache.evict → cache bị xoá → số mới
    patchAs(user, "/api/v1/places/" + placeId, "{\"name\": \"Quán A2\", \"version\": 0}").andExpect(status().isOk());
    await()
        .atMost(WAIT)
        .untilAsserted(
            () ->
                getAs(user, "/api/v1/stats")
                    .andExpect(jsonPath("$.cafes").value(0))
                    .andExpect(jsonPath("$.bars").value(1)));
  }

  @Test
  void girlfriendChangesEvictStatsToo() throws Exception {
    UUID user = newUser();
    getAs(user, "/api/v1/stats").andExpect(jsonPath("$.girlfriends").value(0));

    createGirlfriend(user, "Mai");

    await().atMost(WAIT).untilAsserted(() -> getAs(user, "/api/v1/stats").andExpect(jsonPath("$.girlfriends").value(1)));
  }

  @Test
  void cacheIsPerUser() throws Exception {
    UUID alice = newUser();
    UUID bob = newUser();
    createPlace(alice, "bar", "Của Alice");

    await().atMost(WAIT).untilAsserted(() -> getAs(alice, "/api/v1/stats").andExpect(jsonPath("$.bars").value(1)));
    getAs(bob, "/api/v1/stats").andExpect(jsonPath("$.bars").value(0));
  }
}
