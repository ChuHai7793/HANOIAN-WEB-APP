package com.gfmaster.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gfmaster.support.ApiTestSupport;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.JsonNode;

/**
 * Nhập "Khám phá quán" với một máy chủ Overpass giả trên cổng 18765 (application-test.yml), không gọi
 * Internet. Mỗi ô (quận × loại) trả dữ liệu cố định; Hoàn Kiếm – Bar trả 504 để thử ô bị lỗi.
 */
class CatalogImportIT extends ApiTestSupport {

  private static final Duration WAIT = Duration.ofSeconds(20);
  private static HttpServer overpass;
  /** Tây Hồ – Cafe chờ latch này, để giữ một lượt nhập "đang chạy". */
  private static volatile CountDownLatch holdTayHo = new CountDownLatch(0);

  @Autowired JdbcTemplate jdbc;

  @BeforeAll
  static void startFakeOverpass() throws IOException {
    overpass = HttpServer.create(new InetSocketAddress("localhost", 18765), 0);
    overpass.createContext(
        "/api/interpreter",
        exchange -> {
          String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
          String query = URLDecoder.decode(body.substring("data=".length()), StandardCharsets.UTF_8);
          int status = 200;
          String json;
          if (query.contains(CatalogDistrict.TAY_HO.overpassBbox())) {
            hold(holdTayHo);
            json = elements(node(900, "Tây Hồ Cafe", 21.06, 105.82));
          } else if (query.contains(CatalogDistrict.HOAN_KIEM.overpassBbox())) {
            if (query.contains("bar|pub")) {
              status = 504;
              json = "";
            } else {
              json =
                  elements(
                      node(1, "Cafe Giảng", 21.0285, 105.8543),
                      "{\"type\": \"way\", \"id\": 2, \"center\": {\"lat\": 21.03, \"lon\": 105.85},"
                          + " \"tags\": {\"name\": \"Cộng Cà Phê\", \"addr:street\": \"Tràng Tiền\"}}");
            }
          } else if (query.contains("bar|pub")) {
            json = elements(node(5, "Polite Pub", 21.035, 105.83));
          } else {
            // Ba Đình – Cafe: quán 1 nằm ở vùng chồng lấn, đã thấy ở Hoàn Kiếm
            json = elements(node(1, "Cafe Giảng", 21.0285, 105.8543), node(4, "Highlands Ba Đình", 21.04, 105.83));
          }
          byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
          exchange.sendResponseHeaders(status, bytes.length == 0 ? -1 : bytes.length);
          try (OutputStream out = exchange.getResponseBody()) {
            out.write(bytes);
          }
        });
    overpass.start();
  }

  @AfterAll
  static void stopFakeOverpass() {
    overpass.stop(0);
  }

  @Test
  void importsCellsUpsertsOnRerunAndRecordsFailedCells() throws Exception {
    awaitNoRunning();
    jdbc.update("update places set catalog_id = null");
    jdbc.update("delete from place_catalog");
    UUID admin = newUser();
    UUID guest = newGuestOf(admin);
    String body = "{\"districts\": [\"HOAN_KIEM\", \"BA_DINH\"], \"types\": [\"cafe\", \"bar\"]}";

    // Guest không được nhập
    postAs(guest, "/api/v1/admin/catalog/import", body).andExpect(status().isForbidden());

    JsonNode run = body(postAs(admin, "/api/v1/admin/catalog/import", body).andExpect(status().isAccepted()));
    assertThat(run.get("status").asString()).isEqualTo("RUNNING");
    assertThat(run.get("totalCells").asInt()).isEqualTo(4);
    JsonNode done = awaitFinished(admin, run.get("id").asString());
    assertThat(done.get("status").asString()).isEqualTo("DONE");
    assertThat(done.get("doneCells").asInt()).isEqualTo(4);
    // Hoàn Kiếm – Cafe: 2 mới; Ba Đình – Cafe: 1 mới + 1 đã có; Ba Đình – Bar: 1 mới
    assertThat(done.get("added").asInt()).isEqualTo(4);
    assertThat(done.get("updated").asInt()).isEqualTo(1);
    assertThat(done.get("errors").get(0).asString()).startsWith("Hoàn Kiếm – Bar:").contains("504");
    assertThat(count()).isEqualTo(4);

    // Nhập lại: không nhân đôi, chỉ cập nhật
    JsonNode again = awaitFinished(admin, body(postAs(admin, "/api/v1/admin/catalog/import", body)).get("id").asString());
    assertThat(again.get("added").asInt()).isZero();
    assertThat(count()).isEqualTo(4);

    // Mọi người đều xem được danh mục; tìm không phân biệt hoa thường, lọc loại và quận
    getAs(guest, "/api/v1/catalog?q=giảng")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(1))
        .andExpect(jsonPath("$.items[0].name").value("Cafe Giảng"))
        .andExpect(jsonPath("$.items[0].district").value("Hoàn Kiếm"))
        .andExpect(jsonPath("$.items[0].inNotebook").value(false));
    getAs(guest, "/api/v1/catalog?type=bar").andExpect(jsonPath("$.total").value(1));
    getAs(guest, "/api/v1/catalog?district=BA_DINH").andExpect(jsonPath("$.total").value(2));
    getAs(guest, "/api/v1/catalog?q=TRÀNG TIỀN").andExpect(jsonPath("$.items[0].address").value("Tràng Tiền"));
    getAs(guest, "/api/v1/catalog?size=1000").andExpect(jsonPath("$.size").value(CatalogService.MAX_PAGE_SIZE));
    getAs(guest, "/api/v1/catalog/districts").andExpect(jsonPath("$[0].code").value("BA_DINH"));

    // Admin thêm quán vào sổ tay từ danh mục: danh mục hiện "đã có trong sổ tay" (cả với guest)
    String catalogId = body(getAs(admin, "/api/v1/catalog?q=Polite")).get("items").get(0).get("id").asString();
    postAs(
            admin,
            "/api/v1/places",
            """
            {"type": "bar", "name": "Polite Pub", "priceRange": "medium", "rating": 4,
             "openTime": "17:00", "closeTime": "23:30", "catalogId": "%s"}
            """
                .formatted(catalogId))
        .andExpect(status().isCreated());
    getAs(guest, "/api/v1/catalog?q=Polite").andExpect(jsonPath("$.items[0].inNotebook").value(true));
  }

  @Test
  void onlyOneRunAtATime() throws Exception {
    awaitNoRunning();
    UUID admin = newUser();
    holdTayHo = new CountDownLatch(1);
    try {
      String first =
          body(
                  postAs(admin, "/api/v1/admin/catalog/import", "{\"districts\": [\"TAY_HO\"], \"types\": [\"cafe\"]}")
                      .andExpect(status().isAccepted()))
              .get("id")
              .asString();
      postAs(admin, "/api/v1/admin/catalog/import", "{\"districts\": [\"BA_DINH\"], \"types\": [\"cafe\"]}")
          .andExpect(status().isLocked())
          .andExpect(jsonPath("$.code").value("IMPORT_RUNNING"));
      holdTayHo.countDown();
      assertThat(awaitFinished(admin, first).get("status").asString()).isEqualTo("DONE");
    } finally {
      holdTayHo.countDown();
    }
  }

  @Test
  void invalidRequestIsRejected() throws Exception {
    UUID admin = newUser();
    postAs(admin, "/api/v1/admin/catalog/import", "{\"districts\": [], \"types\": [\"cafe\"]}")
        .andExpect(status().isBadRequest());
    postAs(admin, "/api/v1/admin/catalog/import", "{\"districts\": [\"KHONG_CO\"], \"types\": [\"cafe\"]}")
        .andExpect(status().isBadRequest());
  }

  // ---- Helpers ----

  private JsonNode awaitFinished(UUID admin, String runId) {
    JsonNode[] last = new JsonNode[1];
    await()
        .atMost(WAIT)
        .until(
            () -> {
              for (JsonNode r : body(getAs(admin, "/api/v1/admin/catalog/runs"))) {
                if (r.get("id").asString().equals(runId)) last[0] = r;
              }
              return last[0] != null && !"RUNNING".equals(last[0].get("status").asString());
            });
    return last[0];
  }

  /** Lượt nhập của test khác (chạy nền) phải xong trước, vì chỉ một lượt chạy cùng lúc. */
  private void awaitNoRunning() {
    await()
        .atMost(WAIT)
        .until(() -> jdbc.queryForObject("select count(*) from catalog_import_runs where status = 'RUNNING'", Long.class) == 0);
  }

  private long count() {
    return jdbc.queryForObject("select count(*) from place_catalog", Long.class);
  }

  private static String node(long id, String name, double lat, double lon) {
    return "{\"type\": \"node\", \"id\": %d, \"lat\": %s, \"lon\": %s, \"tags\": {\"name\": \"%s\"}}"
        .formatted(id, lat, lon, name);
  }

  private static String elements(String... items) {
    return "{\"elements\": [" + String.join(",", items) + "]}";
  }

  private static void hold(CountDownLatch latch) {
    try {
      latch.await(15, TimeUnit.SECONDS);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }
}
