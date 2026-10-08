package com.gfmaster.importer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gfmaster.messaging.Topology;
import com.gfmaster.support.ApiTestSupport;
import java.time.Duration;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.MessageListenerContainer;
import org.springframework.amqp.rabbit.listener.RabbitListenerEndpointRegistry;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.JsonNode;

class ImportIT extends ApiTestSupport {

  private static final Duration WAIT = Duration.ofSeconds(20);

  @Autowired JdbcTemplate jdbc;
  @Autowired StringRedisTemplate redis;
  @Autowired RabbitListenerEndpointRegistry listeners;

  /** Giống localStorage của frontend cũ: id dạng chuỗi, ảnh data: URL, field thừa (placeType...). */
  private static String legacyPayload() throws Exception {
    String dataUrl = "data:image/png;base64," + Base64.getEncoder().encodeToString(png(1600, 900));
    return """
        {"places": [
          {"id": "place_cafe_1", "type": "cafe", "name": "Cà phê cũ", "address": "1 Hàng Bông",
           "priceRange": "medium", "rating": 4, "openTime": "07:00", "closeTime": "22:00",
           "imageUrl": "%s", "note": "", "googleMapsUrl": "https://www.google.com/maps/@21.03,105.85,17z",
           "lat": null, "lng": null, "hasWifi": true, "hasParking": false,
           "createdAt": "2025-05-01T00:00:00.000Z", "updatedAt": "2025-05-02T00:00:00.000Z"},
          {"id": "place_res_9", "type": "restaurant", "name": "Quán ăn cũ", "address": "",
           "priceRange": "cheap", "rating": 5, "openTime": "10:00", "closeTime": "21:00",
           "imageUrl": "https://images.unsplash.com/photo-1?w=600", "note": "Ngon", "googleMapsUrl": "",
           "lat": 21.02, "lng": 105.84, "cuisine": "Món Việt"},
          {"id": "place_bad", "type": "cafe", "name": "", "priceRange": "medium", "rating": 4,
           "openTime": "07:00", "closeTime": "22:00"},
          {"id": "place_bad2", "type": "karaoke", "name": "Sai loại", "priceRange": "medium", "rating": 4,
           "openTime": "07:00", "closeTime": "22:00"}
        ],
        "girlfriends": [
          {"id": "gf_1", "name": "Mai", "nickname": "Mèo", "avatarUrl": "", "birthday": "1999-04-12",
           "phone": "0901234567", "status": "dating", "startedDate": "", "hobbies": ["Cà phê", " ", "Phim"],
           "note": "", "createdAt": "2025-05-01T00:00:00.000Z"}
        ],
        "placeLinks": [
          {"id": "link_1", "girlfriendId": "gf_1", "placeId": "place_cafe_1", "placeType": "cafe",
           "herRating": 5, "lastVisitedAt": "2025-12-24", "memory": "Giáng sinh"},
          {"id": "link_dup", "girlfriendId": "gf_1", "placeId": "place_cafe_1", "herRating": 4, "lastVisitedAt": ""},
          {"id": "link_orphan", "girlfriendId": "gf_1", "placeId": "place_bad", "herRating": 4, "lastVisitedAt": ""}
        ]}
        """
        .formatted(dataUrl);
  }

  @Test
  void importsLegacyDataWithImagesInBackground() throws Exception {
    UUID user = newUser();
    ResultActions accepted =
        importAs(user, legacyPayload()).andExpect(status().isAccepted()).andExpect(header().exists("Location"));
    String jobId = body(accepted).get("jobId").asString();

    JsonNode job = awaitFinished(user, jobId);
    assertThat(job.get("status").asString()).isEqualTo("DONE");
    JsonNode stats = job.get("stats");
    assertThat(stats.get("places").asInt()).isEqualTo(2);
    assertThat(stats.get("girlfriends").asInt()).isEqualTo(1);
    assertThat(stats.get("placeLinks").asInt()).isEqualTo(1);
    assertThat(stats.get("images").asInt()).isEqualTo(1);
    assertThat(stats.get("skipped").asInt()).isEqualTo(4);
    // 2 quán hỏng (thiếu tên, sai loại), 1 link trùng, 1 link trỏ tới quán đã bị bỏ qua
    assertThat(stats.get("skippedReasons").toString()).contains("Sai loại").contains("trùng").contains("đã bị bỏ qua");

    JsonNode places = body(getAs(user, "/api/v1/places"));
    assertThat(places).hasSize(2);
    JsonNode cafe = find(places, "Cà phê cũ");
    // Ảnh data: URL được decode, thu nhỏ (1600 → 1200) và lưu như upload thường
    assertThat(cafe.get("imageUrl").asString()).startsWith("/uploads/" + user + "/").endsWith(".webp");
    mvc.perform(get(cafe.get("imageUrl").asString())).andExpect(status().isOk());
    // Toạ độ được điền từ link Google Maps đầy đủ (Phase 7)
    assertThat(cafe.get("lat").asDouble()).isEqualTo(21.03);
    assertThat(find(places, "Quán ăn cũ").get("hasWifi").isNull()).isTrue();

    JsonNode gfs = body(getAs(user, "/api/v1/girlfriends"));
    assertThat(gfs).hasSize(1);
    assertThat(gfs.get(0).get("hobbies").toString()).isEqualTo("[\"Cà phê\",\"Phim\"]");
    assertThat(gfs.get(0).get("startedDate").isNull()).isTrue();
    assertThat(body(getAs(user, "/api/v1/place-links"))).hasSize(1);

    // Xong thì nhả khoá và bỏ payload
    assertThat(redis.hasKey(ImportLock.key(user))).isFalse();
    assertThat(jdbc.queryForObject("select payload from import_jobs where id = ?::uuid", String.class, jobId)).isNull();
  }

  @Test
  void secondImportWhileFirstIsRunningIsLocked() throws Exception {
    UUID user = newUser();
    MessageListenerContainer consumer = listeners.getListenerContainer(Topology.IMPORT);
    consumer.stop();
    String first;
    try {
      first = body(importAs(user, legacyPayload()).andExpect(status().isAccepted())).get("jobId").asString();
      importAs(user, legacyPayload())
          .andExpect(status().isLocked())
          .andExpect(jsonPath("$.code").value("IMPORT_RUNNING"));
      // User khác không bị ảnh hưởng
      importAs(newUser(), "{\"girlfriends\": [{\"name\": \"Lan\"}]}").andExpect(status().isAccepted());
      getAs(user, "/api/v1/import/jobs/" + first).andExpect(jsonPath("$.status").value("QUEUED"));
    } finally {
      consumer.start();
    }
    assertThat(awaitFinished(user, first).get("status").asString()).isEqualTo("DONE");
    // Khoá đã nhả: import tiếp được
    importAs(user, "{\"girlfriends\": [{\"name\": \"Lan\"}]}").andExpect(status().isAccepted());
  }

  @Test
  void rejectsMalformedEmptyOrTooLargePayload() throws Exception {
    UUID user = newUser();
    importAs(user, "{not json").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"));
    importAs(user, "{\"places\": \"không phải mảng\"}").andExpect(status().isBadRequest());
    importAs(user, "{}").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));

    String huge = "{\"places\": [], \"note\": \"" + "x".repeat(10 * 1024 * 1024) + "\"}";
    importAs(user, huge).andExpect(status().isContentTooLarge()).andExpect(jsonPath("$.code").value("IMPORT_TOO_LARGE"));

    // Bị từ chối trước khi lấy khoá: không để lại khoá nào
    assertThat(redis.hasKey(ImportLock.key(user))).isFalse();
    assertThat(jdbc.queryForObject("select count(*) from import_jobs where user_id = ?::uuid", Integer.class, user.toString()))
        .isZero();
  }

  @Test
  void jobOfAnotherUserIsNotFound() throws Exception {
    UUID owner = newUser();
    String jobId = body(importAs(owner, "{\"girlfriends\": [{\"name\": \"Lan\"}]}")).get("jobId").asString();
    getAs(newUser(), "/api/v1/import/jobs/" + jobId).andExpect(status().isNotFound());
    awaitFinished(owner, jobId);
  }

  // ---- Helpers ----

  private ResultActions importAs(UUID user, String json) throws Exception {
    return mvc.perform(
        post("/api/v1/import/local-storage")
            .header(HttpHeaders.AUTHORIZATION, bearer(user))
            .contentType(MediaType.APPLICATION_JSON)
            .content(json));
  }

  private JsonNode awaitFinished(UUID user, String jobId) {
    JsonNode[] last = new JsonNode[1];
    await()
        .atMost(WAIT)
        .until(
            () -> {
              last[0] = body(getAs(user, "/api/v1/import/jobs/" + jobId).andExpect(status().isOk()));
              String s = last[0].get("status").asString();
              return s.equals("DONE") || s.equals("FAILED");
            });
    return last[0];
  }

  private static JsonNode find(JsonNode array, String name) {
    for (JsonNode n : array) if (n.get("name").asString().equals(name)) return n;
    throw new AssertionError("Không thấy " + name);
  }
}
