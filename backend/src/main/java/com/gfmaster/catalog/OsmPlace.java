package com.gfmaster.catalog;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import tools.jackson.databind.JsonNode;

/**
 * Một quán đọc từ kết quả Overpass ({@code out center tags}). Chỉ giữ những gì app dùng; chuỗi dài
 * được cắt cho vừa cột. {@link #parse} trả null nếu thiếu tên hoặc toạ độ.
 */
public record OsmPlace(
    String externalId,
    String name,
    String address,
    BigDecimal lat,
    BigDecimal lng,
    String openingHours,
    String cuisine,
    String phone,
    String website,
    Boolean hasWifi) {

  static OsmPlace parse(JsonNode el) {
    JsonNode tags = el.path("tags");
    String name = text(tags, "name");
    // Node có lat/lon; way/relation (toà nhà, khu) có toạ độ tâm trong "center"
    JsonNode point = el.has("lat") ? el : el.path("center");
    if (name == null || !point.has("lat") || !point.has("lon")) return null;

    return new OsmPlace(
        el.path("type").asString() + "/" + el.path("id").asString(),
        cut(name, 255),
        cut(address(tags), 500),
        coordinate(point.path("lat").asDouble()),
        coordinate(point.path("lon").asDouble()),
        cut(text(tags, "opening_hours"), 255),
        cut(cuisine(tags), 100),
        cut(first(tags, "phone", "contact:phone"), 50),
        cut(first(tags, "website", "contact:website"), 500),
        wifi(text(tags, "internet_access")));
  }

  /** "12 Phố Huế, Hàng Bài": số nhà + đường, rồi phường nếu có. OSM thường thiếu, nên có thể null. */
  private static String address(JsonNode tags) {
    String full = text(tags, "addr:full");
    if (full != null) return full;
    List<String> parts = new ArrayList<>();
    // Số nhà chỉ có nghĩa khi đi kèm tên đường ("6" đứng một mình thì bỏ)
    String street = text(tags, "addr:street");
    if (street != null) parts.add(String.join(" ", nonNull(text(tags, "addr:housenumber"), street)));
    String ward = first(tags, "addr:subdistrict", "addr:quarter", "addr:suburb");
    if (ward != null) parts.add(ward);
    return parts.isEmpty() ? null : String.join(", ", parts);
  }

  /** "vietnamese;noodle" → "vietnamese, noodle" */
  private static String cuisine(JsonNode tags) {
    String c = text(tags, "cuisine");
    return c == null ? null : c.replace(";", ", ");
  }

  private static Boolean wifi(String internetAccess) {
    if (internetAccess == null) return null;
    return switch (internetAccess) {
      case "wlan", "wifi", "yes", "terminal" -> true;
      case "no" -> false;
      default -> null;
    };
  }

  private static BigDecimal coordinate(double value) {
    return BigDecimal.valueOf(value).setScale(6, RoundingMode.HALF_UP);
  }

  private static String first(JsonNode tags, String... keys) {
    for (String k : keys) {
      String v = text(tags, k);
      if (v != null) return v;
    }
    return null;
  }

  private static String text(JsonNode tags, String key) {
    JsonNode v = tags.get(key);
    if (v == null || v.isNull()) return null;
    String s = v.asString().trim();
    return s.isEmpty() ? null : s;
  }

  private static List<String> nonNull(String... values) {
    List<String> out = new ArrayList<>();
    for (String v : values) if (v != null) out.add(v);
    return out;
  }

  private static String cut(String s, int max) {
    return s == null || s.length() <= max ? s : s.substring(0, max);
  }
}
