package com.gfmaster.catalog;

import com.gfmaster.place.PlaceType;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Gọi Overpass API (OpenStreetMap). Máy chủ miễn phí hay quá tải (504) nên thử lần lượt các máy chủ
 * trong {@code gfm.catalog.overpass-urls}, nghỉ {@code retryDelay} giữa hai lần.
 */
@Component
public class OverpassClient {

  private static final Logger log = LoggerFactory.getLogger(OverpassClient.class);

  private final CatalogProperties props;
  private final JsonMapper json;
  private final HttpClient http;

  public OverpassClient(CatalogProperties props, JsonMapper json) {
    this.props = props;
    this.json = json;
    this.http = HttpClient.newBuilder().connectTimeout(props.requestTimeout()).build();
  }

  /** Quán có tên thuộc {@code type} trong khung toạ độ của {@code district}. */
  public List<OsmPlace> fetch(PlaceType type, CatalogDistrict district) {
    String query = query(type, district);
    String lastError = null;
    for (String url : props.overpassUrls()) {
      try {
        HttpResponse<String> res = http.send(request(url, query), HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() == 200) return parse(res.body());
        lastError = "máy chủ OSM trả lỗi " + res.statusCode();
      } catch (IOException e) {
        lastError = "không kết nối được máy chủ OSM";
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        throw new OverpassException("bị dừng giữa chừng");
      }
      log.warn("Overpass {} failed for {} {}: {}", url, district, type, lastError);
      sleep();
    }
    throw new OverpassException(Objects.requireNonNullElse(lastError, "không có máy chủ OSM nào"));
  }

  /** cafe → amenity=cafe; restaurant → amenity=restaurant; bar → amenity=bar hoặc pub. */
  static String query(PlaceType type, CatalogDistrict district) {
    String amenity =
        switch (type) {
          case cafe -> "cafe";
          case restaurant -> "restaurant";
          case bar -> "bar|pub";
        };
    return "[out:json][timeout:80];nwr[\"amenity\"~\"^(%s)$\"][\"name\"]%s;out center tags;"
        .formatted(amenity, district.overpassBbox());
  }

  private HttpRequest request(String url, String query) {
    return HttpRequest.newBuilder(URI.create(url))
        .timeout(props.requestTimeout())
        .header("Content-Type", "application/x-www-form-urlencoded")
        // Quy định của Overpass: ghi rõ ứng dụng nào đang gọi
        .header("User-Agent", "DatingMaster/1.0 (place catalog import)")
        .POST(HttpRequest.BodyPublishers.ofString("data=" + URLEncoder.encode(query, StandardCharsets.UTF_8)))
        .build();
  }

  private List<OsmPlace> parse(String body) {
    List<OsmPlace> out = new ArrayList<>();
    for (JsonNode el : json.readTree(body).path("elements")) {
      OsmPlace p = OsmPlace.parse(el);
      if (p != null) out.add(p);
    }
    return out;
  }

  private void sleep() {
    try {
      Thread.sleep(props.retryDelay());
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }

  /** Mọi máy chủ Overpass đều lỗi; message tiếng Việt, hiện trong lịch sử nhập. */
  public static class OverpassException extends RuntimeException {
    public OverpassException(String message) {
      super(message);
    }
  }
}
