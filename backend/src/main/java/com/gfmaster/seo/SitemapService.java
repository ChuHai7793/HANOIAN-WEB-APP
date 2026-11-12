package com.gfmaster.seo;

import com.gfmaster.catalog.CatalogDistrict;
import com.gfmaster.place.PlaceType;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Đường dẫn công khai cho sitemap.xml (server SSR dựng file XML): trang riêng của quán, chỗ chơi, bài viết đã xuất
 * bản, và các trang hub theo loại / khu vực đang có dữ liệu (từ khoá "quán cafe hẹn hò Cầu Giấy"...).
 *
 * <p>Đường dẫn hub phải khớp app.routes.ts của frontend: {@code /quan-cafe}, {@code /quan-bar}, {@code /quan-an}
 * (+ {@code /<slug khu vực>}), {@code /khu-vuc/<slug>}, {@code /cho-choi/khu-vuc/<slug>}.
 */
@Service
public class SitemapService {

  public record Entry(String path, Instant updatedAt) {}

  /** Tiền tố trang hub theo loại quán; cũng dùng trong {@code hubPath}. */
  static final Map<PlaceType, String> TYPE_HUB = new EnumMap<>(Map.of(PlaceType.cafe, "/quan-cafe", PlaceType.bar, "/quan-bar", PlaceType.restaurant, "/quan-an"));

  private final NamedParameterJdbcTemplate jdbc;

  public SitemapService(NamedParameterJdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Transactional(readOnly = true)
  public List<Entry> entries() {
    List<Entry> out = new ArrayList<>();
    out.addAll(hubs());
    out.addAll(jdbc.query("SELECT '/quan/' || slug AS path, updated_at FROM place_catalog WHERE slug IS NOT NULL ORDER BY slug", Map.of(), (rs, i) -> entry(rs)));
    out.addAll(jdbc.query("SELECT '/cho-choi/' || slug AS path, updated_at FROM date_spots WHERE slug IS NOT NULL ORDER BY slug", Map.of(), (rs, i) -> entry(rs)));
    out.addAll(jdbc.query("SELECT '/cam-nang/' || slug AS path, updated_at FROM articles WHERE status = 'published' ORDER BY published_at DESC", Map.of(), (rs, i) -> entry(rs)));
    return out;
  }

  /** Trang hub chỉ đưa vào sitemap khi có ít nhất một địa điểm; lastmod là lần sửa gần nhất trong nhóm. */
  private List<Entry> hubs() {
    List<Entry> out = new ArrayList<>();
    Map<PlaceType, Instant> byType = new EnumMap<>(PlaceType.class);
    Map<CatalogDistrict, Instant> byDistrict = new EnumMap<>(CatalogDistrict.class);
    jdbc.query(
        "SELECT type, district, max(updated_at) AS updated_at FROM place_catalog GROUP BY type, district",
        Map.of(),
        (ResultSet rs) -> {
          PlaceType type = PlaceType.valueOf(rs.getString("type"));
          CatalogDistrict district = CatalogDistrict.valueOf(rs.getString("district"));
          Instant at = instant(rs.getTimestamp("updated_at"));
          byType.merge(type, at, SitemapService::later);
          byDistrict.merge(district, at, SitemapService::later);
          out.add(new Entry(TYPE_HUB.get(type) + "/" + district.slug(), at));
        });
    byType.forEach((t, at) -> out.add(new Entry(TYPE_HUB.get(t), at)));
    byDistrict.forEach((d, at) -> out.add(new Entry("/khu-vuc/" + d.slug(), at)));
    jdbc.query(
        "SELECT district, max(updated_at) AS updated_at FROM date_spots GROUP BY district",
        Map.of(),
        (ResultSet rs) -> {
          out.add(new Entry("/cho-choi/khu-vuc/" + CatalogDistrict.valueOf(rs.getString("district")).slug(), instant(rs.getTimestamp("updated_at"))));
        });
    return out;
  }

  private static Instant later(Instant a, Instant b) {
    return a == null ? b : b == null ? a : a.isAfter(b) ? a : b;
  }

  private static Entry entry(ResultSet rs) throws SQLException {
    return new Entry(rs.getString("path"), instant(rs.getTimestamp("updated_at")));
  }

  private static Instant instant(Timestamp t) {
    return t == null ? null : t.toInstant();
  }
}
