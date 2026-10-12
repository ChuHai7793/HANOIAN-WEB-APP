package com.gfmaster.vibe;

import java.util.Arrays;

/**
 * Nhãn kiểu hẹn đến từ đâu, cũng là thứ tự được ghi đè: {@code DEFAULT} (suy ra từ loại) &lt; {@code CLAUDE}
 * (Claude gán từ mô tả) &lt; {@code ADMIN} (admin sửa tay, không gì tự ghi đè).
 */
public enum VibeSource {
  DEFAULT("default"),
  CLAUDE("claude"),
  ADMIN("admin");

  private final String code;

  VibeSource(String code) {
    this.code = code;
  }

  /** Giá trị trong DB và JSON */
  public String code() {
    return code;
  }

  public static VibeSource of(String code) {
    return Arrays.stream(values())
        .filter(s -> s.code.equals(code))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("vibes_source không hợp lệ: " + code));
  }
}
