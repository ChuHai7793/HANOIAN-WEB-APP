package com.gfmaster.catalog;

import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.error.ErrorCode;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Predicate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Khối "nổi bật" admin chọn (V25 {@code featured_places}, V30 {@code featured_spots}): cùng cấu trúc, chỉ khác tên
 * bảng và cột khoá ngoại. Tên bảng / cột là hằng trong code, không bao giờ lấy từ request.
 */
@Component
public class FeaturedSlots {

  public static final int MAX = 10;

  /** Một bảng nổi bật: {@code table} và cột trỏ tới địa điểm ({@code catalog_id} / {@code spot_id}). */
  public record Table(String table, String idColumn) {
    public static final Table PLACES = new Table("featured_places", "catalog_id");
    public static final Table SPOTS = new Table("featured_spots", "spot_id");
  }

  public record Row(int position, UUID id, String kicker, String headline) {}

  /** Yêu cầu của admin: địa điểm, dòng nhỏ, câu dẫn (hai chuỗi có thể null). */
  public record Entry(UUID id, String kicker, String headline) {}

  private final NamedParameterJdbcTemplate jdbc;

  public FeaturedSlots(NamedParameterJdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public List<Row> list(Table t) {
    return jdbc.query(
        "SELECT position, " + t.idColumn() + " AS id, kicker, headline FROM " + t.table() + " ORDER BY position",
        Map.of(),
        (rs, i) -> new Row(rs.getInt("position"), rs.getObject("id", UUID.class), rs.getString("kicker"), rs.getString("headline")));
  }

  /**
   * Thay toàn bộ danh sách (thứ tự = vị trí; rỗng = tắt khối). {@code exists}: địa điểm có tồn tại không (404 nếu không).
   * {@code what}: tên gọi trong thông báo lỗi ("quán", "chỗ chơi").
   */
  public void replace(Table t, List<Entry> list, Predicate<UUID> exists, String what) {
    if (list.size() > MAX) throw new ApiException(ErrorCode.VALIDATION_FAILED, "Tối đa " + MAX + " " + what + " nổi bật.");
    if (list.stream().map(Entry::id).distinct().count() != list.size()) {
      throw new ApiException(ErrorCode.VALIDATION_FAILED, "Mỗi " + what + " chỉ chọn một lần.");
    }
    for (Entry e : list) if (!exists.test(e.id())) throw ApiException.notFound();
    jdbc.update("DELETE FROM " + t.table(), Map.of());
    for (int i = 0; i < list.size(); i++) {
      Entry e = list.get(i);
      jdbc.update(
          "INSERT INTO " + t.table() + " (position, " + t.idColumn() + ", kicker, headline) VALUES (:pos, :id, :kicker, :headline)",
          Map.of(
              "pos", i + 1,
              "id", e.id(),
              "kicker", e.kicker() == null ? "" : e.kicker().strip(),
              "headline", e.headline() == null ? "" : e.headline().strip()));
    }
  }
}
