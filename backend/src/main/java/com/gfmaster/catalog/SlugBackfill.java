package com.gfmaster.catalog;

import com.gfmaster.common.web.Slugs;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Khi khởi động: quán / chỗ chơi chưa có đường dẫn trang riêng (dữ liệu có trước V28, hoặc nạp thẳng bằng SQL) thì
 * điền slug từ tên. Cập nhật bằng SQL, không đụng version (form sửa đang mở không bị báo xung đột). Chạy lại vô hại.
 */
@Component
public class SlugBackfill implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(SlugBackfill.class);

  private final NamedParameterJdbcTemplate jdbc;

  public SlugBackfill(NamedParameterJdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    fill("place_catalog", "quan");
    fill("date_spots", "cho-choi");
  }

  private void fill(String table, String fallback) {
    List<Map<String, Object>> missing =
        jdbc.queryForList("SELECT id, name FROM " + table + " WHERE slug IS NULL ORDER BY created_at, id", Map.of());
    if (missing.isEmpty()) return;
    Set<String> taken =
        new HashSet<>(jdbc.queryForList("SELECT slug FROM " + table + " WHERE slug IS NOT NULL", Map.of(), String.class));
    for (Map<String, Object> row : missing) {
      String slug = Slugs.unique((String) row.get("name"), fallback, taken::contains);
      taken.add(slug);
      jdbc.update("UPDATE " + table + " SET slug = :slug WHERE id = :id", Map.of("slug", slug, "id", (UUID) row.get("id")));
    }
    log.info("Đã điền đường dẫn trang riêng cho {} dòng {}", missing.size(), table);
  }
}
