package com.gfmaster.common.settings;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

/** Cấu hình chung admin chỉnh trên giao diện (bảng {@code app_settings}, V27): khoá → giá trị. */
@Component
public class AppSettings {

  private final NamedParameterJdbcTemplate jdbc;

  public AppSettings(NamedParameterJdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public Optional<String> get(String key) {
    List<String> v = jdbc.queryForList("SELECT value FROM app_settings WHERE key = :key", Map.of("key", key), String.class);
    return v.isEmpty() ? Optional.empty() : Optional.of(v.getFirst());
  }

  /** {@code value} null / rỗng = xoá khoá (quay về mặc định). */
  public void set(String key, String value) {
    if (value == null || value.isBlank()) {
      jdbc.update("DELETE FROM app_settings WHERE key = :key", Map.of("key", key));
      return;
    }
    jdbc.update(
        """
        INSERT INTO app_settings (key, value, updated_at) VALUES (:key, :value, now())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
        """,
        Map.of("key", key, "value", value));
  }
}
