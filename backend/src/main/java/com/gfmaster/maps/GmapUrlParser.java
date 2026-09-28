package com.gfmaster.maps;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Rút toạ độ từ link Google Maps đầy đủ hoặc từ toạ độ dán thẳng. Cùng quy tắc với
 * {@code frontend/src/app/core/utils/gmap-url.ts}.
 *
 * <p>Thứ tự ưu tiên: {@code !3d..!4d..} (vị trí ghim của địa điểm) trước {@code @lat,lng} (tâm
 * khung bản đồ đang xem, có thể lệch khỏi quán).
 */
public final class GmapUrlParser {

  public record LatLng(double lat, double lng) {}

  private static final String NUM = "(-?\\d+(?:\\.\\d+)?)";
  private static final List<Pattern> PATTERNS =
      List.of(
          Pattern.compile("^" + NUM + "\\s*,\\s*" + NUM + "$"),
          Pattern.compile("!3d" + NUM + "!4d" + NUM),
          Pattern.compile("@" + NUM + "," + NUM),
          Pattern.compile("[?&](?:q|ll|center|destination|query)=" + NUM + ",\\s*\\+?" + NUM),
          Pattern.compile("/maps/search/" + NUM + ",\\s*\\+?" + NUM));

  private GmapUrlParser() {}

  public static Optional<LatLng> parse(String input) {
    if (input == null || input.isBlank()) return Optional.empty();
    String text = decode(input.trim());
    for (Pattern pattern : PATTERNS) {
      Matcher m = pattern.matcher(text);
      if (m.find()) {
        double lat = Double.parseDouble(m.group(1));
        double lng = Double.parseDouble(m.group(2));
        if (isValid(lat, lng)) return Optional.of(new LatLng(lat, lng));
      }
    }
    return Optional.empty();
  }

  /** "?q=21.02,%20105.85" → "?q=21.02, 105.85". Chuỗi % hỏng thì giữ nguyên. */
  private static String decode(String text) {
    try {
      return URLDecoder.decode(text, StandardCharsets.UTF_8);
    } catch (IllegalArgumentException e) {
      return text;
    }
  }

  public static boolean isValid(double lat, double lng) {
    return Double.isFinite(lat) && Double.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  }
}
