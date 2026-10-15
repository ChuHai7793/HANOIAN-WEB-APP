package com.gfmaster.common.web;

import java.text.Normalizer;
import java.util.Locale;
import java.util.function.Predicate;

/**
 * Đường dẫn dễ đọc từ tên tiếng Việt: "Cafe Cuối Ngõ!" → "cafe-cuoi-ngo". Chỉ a-z, 0-9, "-". Dùng cho trang
 * quán / chỗ chơi / bài viết (SEO) và tên file ảnh.
 */
public final class Slugs {

  public static final int MAX_LENGTH = 70;

  private Slugs() {}

  /** Rỗng thì trả {@code fallback}. */
  public static String of(String value, int maxLength, String fallback) {
    if (value == null) return fallback;
    String s = value.replace('đ', 'd').replace('Đ', 'D');
    s = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
    s = s.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("^-+|-+$", "");
    if (s.length() > maxLength) s = s.substring(0, maxLength).replaceAll("-+$", "");
    return s.isEmpty() ? fallback : s;
  }

  /** Slug chưa ai dùng: "ten-quan", trùng thì "ten-quan-2", "ten-quan-3"… */
  public static String unique(String name, String fallback, Predicate<String> taken) {
    String base = of(name, MAX_LENGTH - 4, fallback);
    String slug = base;
    for (int i = 2; taken.test(slug); i++) slug = base + "-" + i;
    return slug;
  }
}
