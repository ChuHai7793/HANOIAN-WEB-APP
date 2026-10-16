package com.gfmaster.spot;

import com.gfmaster.catalog.CatalogDistrict;
import com.gfmaster.vibe.Vibe;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;

/**
 * Bộ lọc Tìm chỗ chơi. null / rỗng = không lọc theo mục đó.
 *
 * @param maxPrice giá thấp nhất không quá mức này (0 = chỉ chỗ miễn phí)
 * @param indoor true = chỉ chỗ trong nhà (ngày mưa)
 * @param openAt giờ của người xem; chỗ không có giờ cố định luôn tính là đang mở
 * @param minDuration / maxDuration thời lượng gợi ý (phút); chỗ chưa có thời lượng bị loại khi lọc
 * @param noBooking true = chỉ chỗ không cần đặt trước
 * @param vibes kiểu hẹn, khớp một trong số đó
 */
public record SpotFilter(
    String q,
    SpotCategory category,
    CatalogDistrict district,
    Integer maxPrice,
    Boolean indoor,
    LocalTime openAt,
    Integer minDuration,
    Integer maxDuration,
    boolean noBooking,
    Set<Vibe> vibes) {

  public SpotFilter {
    vibes = vibes == null ? Set.of() : Set.copyOf(vibes);
  }

  public static SpotFilter of(
      String q,
      SpotCategory category,
      CatalogDistrict district,
      Integer maxPrice,
      Boolean indoor,
      LocalTime openAt,
      Integer minDuration,
      Integer maxDuration,
      Boolean noBooking,
      List<Vibe> vibes) {
    return new SpotFilter(
        q, category, district, maxPrice, indoor, openAt, minDuration, maxDuration, Boolean.TRUE.equals(noBooking),
        vibes == null ? null : Set.copyOf(vibes));
  }

  public SpotFilter withCategory(SpotCategory c) {
    return new SpotFilter(q, c, district, maxPrice, indoor, openAt, minDuration, maxDuration, noBooking, vibes);
  }
}
