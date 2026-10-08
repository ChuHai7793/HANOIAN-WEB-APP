package com.gfmaster;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

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

  // ---- Helpers ----

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
