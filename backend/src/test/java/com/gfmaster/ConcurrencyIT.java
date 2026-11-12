package com.gfmaster;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gfmaster.messaging.Topology;
import com.gfmaster.support.ApiTestSupport;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.MessageListenerContainer;
import org.springframework.amqp.rabbit.listener.RabbitListenerEndpointRegistry;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.RequestBuilder;
import tools.jackson.databind.JsonNode;

/**
 * Nhiều luồng bắn cùng lúc vào API thật (PostgreSQL + Redis thật). Mỗi luồng chờ ở cùng một
 * CountDownLatch rồi được thả ra đồng thời để tăng khả năng chạm nhau.
 */
class ConcurrencyIT extends ApiTestSupport {

  @Autowired JdbcTemplate jdbc;
  @Autowired RabbitListenerEndpointRegistry listeners;

  /** (1) Hai thiết bị sửa cùng một quán từ cùng version: đúng một bên thắng, bên kia 409. */
  @Test
  void concurrentPatchWithSameVersionHasExactlyOneWinner() throws Exception {
    UUID user = newUser();
    String id = createPlace(user, "cafe", "Gốc").get("id").asString();

    List<MockHttpServletResponse> results =
        runConcurrently(
            2,
            i ->
                patch("/api/v1/places/" + id)
                    .header(HttpHeaders.AUTHORIZATION, bearer(user))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\": \"Thiết bị " + i + "\", \"version\": 0}"));

    assertThat(statuses(results)).containsExactlyInAnyOrder(200, 409);
    MockHttpServletResponse conflict = results.stream().filter(r -> r.getStatus() == 409).findFirst().orElseThrow();
    assertThat(body(conflict).get("code").asString()).isEqualTo("VERSION_CONFLICT");

    JsonNode stored = body(getAs(user, "/api/v1/places/" + id));
    assertThat(stored.get("version").asInt()).isEqualTo(1);
    MockHttpServletResponse winner = results.stream().filter(r -> r.getStatus() == 200).findFirst().orElseThrow();
    assertThat(stored.get("name").asString()).isEqualTo(body(winner).get("name").asString());
  }

  /** (2) Bấm "Lưu" 10 lần cùng lúc với cùng Idempotency-Key: chỉ tạo đúng một quán. */
  @Test
  void concurrentPostsWithSameIdempotencyKeyCreateOneRecord() throws Exception {
    UUID user = newUser();
    String key = UUID.randomUUID().toString();
    String req =
        """
        {"type": "bar", "name": "Chỉ một", "priceRange": "high", "rating": 5,
         "openTime": "18:00", "closeTime": "23:59"}
        """;

    List<MockHttpServletResponse> results =
        runConcurrently(
            10,
            i ->
                post("/api/v1/places")
                    .header(HttpHeaders.AUTHORIZATION, bearer(user))
                    .header("Idempotency-Key", key)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(req));

    // Mỗi request hoặc tạo/nhận lại bản đã tạo (201), hoặc thấy bản kia đang xử lý (409)
    assertThat(statuses(results)).containsOnly(201, 409).contains(201);
    List<String> createdIds = new ArrayList<>();
    for (MockHttpServletResponse r : results) {
      if (r.getStatus() == 201) createdIds.add(body(r).get("id").asString());
      else assertThat(body(r).get("code").asString()).isEqualTo("IDEMPOTENCY_IN_PROGRESS");
    }
    assertThat(createdIds).allMatch(createdIds.getFirst()::equals);
    assertThat(countPlaces(user)).isEqualTo(1);
  }

  /** (3) Hai request gắn cùng quán cho cùng người yêu: unique constraint chặn bản thứ hai. */
  @Test
  void concurrentLinkOfSamePairCreatesOneLink() throws Exception {
    UUID user = newUser();
    String gf = createGirlfriend(user, "Linh").get("id").asString();
    String place = createPlace(user, "cafe", "Quán chung").get("id").asString();
    String req = "{\"girlfriendId\": \"%s\", \"placeId\": \"%s\", \"herRating\": 4}".formatted(gf, place);

    List<MockHttpServletResponse> results =
        runConcurrently(
            2,
            i ->
                post("/api/v1/place-links")
                    .header(HttpHeaders.AUTHORIZATION, bearer(user))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(req));

    assertThat(statuses(results)).containsExactlyInAnyOrder(201, 409);
    MockHttpServletResponse conflict = results.stream().filter(r -> r.getStatus() == 409).findFirst().orElseThrow();
    assertThat(body(conflict).get("code").asString()).isEqualTo("LINK_ALREADY_EXISTS");
    assertThat(jdbc.queryForObject("select count(*) from place_links where girlfriend_id = ?::uuid", Integer.class, gf))
        .isEqualTo(1);
  }

  /**
   * (4) Hai lần import cùng lúc của một user: khoá Redis chỉ cho một lần chạy. Consumer tạm dừng để
   * lần đầu chưa kịp xong (và nhả khoá) trước khi lần hai tới.
   */
  @Test
  void concurrentImportsOfSameUserOnlyOneIsAccepted() throws Exception {
    UUID user = newUser();
    String payload = "{\"girlfriends\": [{\"name\": \"Lan\"}]}";
    MessageListenerContainer consumer = listeners.getListenerContainer(Topology.IMPORT);
    consumer.stop();
    try {
      List<MockHttpServletResponse> results =
          runConcurrently(
              2,
              i ->
                  post("/api/v1/import/local-storage")
                      .header(HttpHeaders.AUTHORIZATION, bearer(user))
                      .contentType(MediaType.APPLICATION_JSON)
                      .content(payload));

      assertThat(statuses(results)).containsExactlyInAnyOrder(202, 423);
      MockHttpServletResponse locked = results.stream().filter(r -> r.getStatus() == 423).findFirst().orElseThrow();
      assertThat(body(locked).get("code").asString()).isEqualTo("IMPORT_RUNNING");
      assertThat(jdbc.queryForObject("select count(*) from import_jobs where user_id = ?::uuid", Integer.class, user.toString()))
          .isEqualTo(1);
    } finally {
      consumer.start();
    }
  }

  /** (5) Hai người thích nhau cùng lúc: đúng một match được tạo, không bên nào "trượt" match. */
  @Test
  void mutualLikesAtTheSameMomentStillMatch() throws Exception {
    UUID a = datingUser("female", "male");
    UUID b = datingUser("male", "female");
    UUID[] from = {a, b};
    UUID[] to = {b, a};

    List<MockHttpServletResponse> results =
        runConcurrently(
            2,
            i ->
                post("/api/v1/dating/swipes")
                    .header(HttpHeaders.AUTHORIZATION, bearer(from[i]))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"targetId\": \"%s\", \"liked\": true}".formatted(to[i])));

    assertThat(statuses(results)).containsOnly(200);
    long matchedResponses = results.stream().filter(r -> readBody(r).get("matched").asBoolean()).count();
    assertThat(matchedResponses).isEqualTo(1);
    assertThat(
            jdbc.queryForObject(
                "select count(*) from matches where (user_a = ?::uuid and user_b = ?::uuid) or (user_a = ?::uuid and user_b = ?::uuid)",
                Integer.class, a.toString(), b.toString(), b.toString(), a.toString()))
        .isEqualTo(1);
  }

  /** (6) Năm người đánh giá cùng một quán cùng lúc: điểm trung bình và số đánh giá lưu trên quán đúng với cả năm. */
  @Test
  void concurrentReviewsKeepTheStoredAverageExact() throws Exception {
    UUID admin = newUser();
    String place =
        body(postAs(admin, "/api/v1/admin/catalog", """
            {"type": "cafe", "district": "HOAN_KIEM", "name": "Quán đông khách", "priceRange": "medium",
             "rating": 4, "openTime": "07:00", "closeTime": "22:00"}
            """).andExpect(status().isCreated())).get("id").asString();
    UUID[] reviewers = new UUID[5];
    for (int i = 0; i < reviewers.length; i++) reviewers[i] = newGuestOf(admin);

    List<MockHttpServletResponse> results =
        runConcurrently(
            reviewers.length,
            i ->
                put("/api/v1/reviews/mine?target=place&id=" + place)
                    .header(HttpHeaders.AUTHORIZATION, bearer(reviewers[i]))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"rating\": %d, \"body\": \"Nhận xét đủ mười ký tự\", \"companion\": \"lover\"}".formatted(i + 1)));

    assertThat(statuses(results)).containsOnly(200);
    assertThat(jdbc.queryForObject("select rating_count from place_catalog where id = ?::uuid", Integer.class, place)).isEqualTo(5);
    assertThat(jdbc.queryForObject("select rating_avg from place_catalog where id = ?::uuid", java.math.BigDecimal.class, place))
        .isEqualByComparingTo("3.0");
  }

  /** (7) Thêm 15 điểm vào một plan cùng lúc: đúng 12 (MAX_STOPS) được nhận, vị trí 0..11 không trùng. */
  @Test
  void concurrentAddStopsRespectMaxStopsAndUniquePositions() throws Exception {
    UUID admin = newUser();
    String cafe =
        body(postAs(admin, "/api/v1/admin/catalog", """
            {"type": "cafe", "district": "HOAN_KIEM", "name": "Quán nhiều điểm", "priceRange": "medium",
             "rating": 4, "openTime": "07:00", "closeTime": "23:00"}
            """).andExpect(status().isCreated())).get("id").asString();
    String plan =
        body(postAs(admin, "/api/v1/plans", "{\"title\": \"Đi suốt ngày\", \"startTime\": \"08:00\", \"district\": \"HOAN_KIEM\"}")
                .andExpect(status().isCreated()))
            .get("id")
            .asString();

    List<MockHttpServletResponse> results =
        runConcurrently(
            15,
            i ->
                post("/api/v1/plans/" + plan + "/stops")
                    .header(HttpHeaders.AUTHORIZATION, bearer(admin))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"kind\": \"place\", \"refId\": \"%s\", \"durationMin\": 30, \"position\": 0}".formatted(cafe)));

    assertThat(statuses(results)).containsOnly(200, 409);
    assertThat(statuses(results).stream().filter(s -> s == 200).count()).isEqualTo(12);
    List<Integer> positions =
        jdbc.queryForList("select position from plan_stops where plan_id = ?::uuid order by position", Integer.class, plan);
    assertThat(positions).containsExactly(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11);
  }

  // ---- Helpers ----

  /** Người đã bật Tìm đối tượng, đủ 18 tuổi, có ảnh. */
  private UUID datingUser(String gender, String interestedIn) {
    UUID id = newUser();
    jdbc.update(
        """
        insert into user_profiles (user_id, avatar_url, birthday, gender, city, bio, completed_at,
                                   created_at, updated_at, version, dating_enabled, interested_in)
        values (?, '/uploads/a.webp', ?, ?, 'Hà Nội', '', now(), now(), now(), 0, true, ?)
        """,
        id, java.time.LocalDate.now().minusYears(25), gender, interestedIn);
    return id;
  }

  private JsonNode readBody(MockHttpServletResponse response) {
    try {
      return body(response);
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  private interface RequestFactory {
    RequestBuilder build(int index) throws Exception;
  }

  private List<MockHttpServletResponse> runConcurrently(int threads, RequestFactory factory) throws Exception {
    // Dựng request trước (tạo JWT tốn thời gian) để các luồng xuất phát sát nhau nhất có thể
    List<RequestBuilder> requests = new ArrayList<>();
    for (int i = 0; i < threads; i++) requests.add(factory.build(i));

    CountDownLatch start = new CountDownLatch(1);
    ExecutorService pool = Executors.newFixedThreadPool(threads);
    try {
      List<Future<MockHttpServletResponse>> futures = new ArrayList<>();
      for (RequestBuilder request : requests) {
        Callable<MockHttpServletResponse> task =
            () -> {
              start.await();
              return mvc.perform(request).andReturn().getResponse();
            };
        futures.add(pool.submit(task));
      }
      start.countDown();
      List<MockHttpServletResponse> results = new ArrayList<>();
      for (Future<MockHttpServletResponse> f : futures) results.add(f.get(30, TimeUnit.SECONDS));
      return results;
    } finally {
      pool.shutdownNow();
    }
  }

  private static List<Integer> statuses(List<MockHttpServletResponse> results) {
    return results.stream().map(MockHttpServletResponse::getStatus).toList();
  }

  private JsonNode body(MockHttpServletResponse response) throws Exception {
    return json.readTree(response.getContentAsString(StandardCharsets.UTF_8));
  }

  private int countPlaces(UUID user) {
    return jdbc.queryForObject("select count(*) from places where user_id = ?::uuid", Integer.class, user.toString());
  }
}
