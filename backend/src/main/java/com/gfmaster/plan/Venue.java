package com.gfmaster.plan;

import com.gfmaster.catalog.CatalogDistrict;
import com.gfmaster.place.PlaceType;
import com.gfmaster.place.PriceRange;
import com.gfmaster.plan.PlanDtos.StopKind;
import com.gfmaster.spot.SpotCategory;
import com.gfmaster.vibe.Vibe;
import com.gfmaster.vibe.VibeScores;
import java.time.LocalTime;
import java.util.Set;
import java.util.UUID;

/**
 * Một địa điểm có thể đưa vào plan: quán trong Khám phá quán ({@code placeType} khác null) hoặc chỗ chơi
 * ({@code spotCategory} khác null). Giờ mở cửa null = không có giờ cố định (luôn đi được).
 */
public record Venue(
    StopKind kind,
    UUID id,
    PlaceType placeType,
    SpotCategory spotCategory,
    String name,
    String address,
    CatalogDistrict district,
    String imageUrl,
    Double lat,
    Double lng,
    LocalTime open,
    LocalTime close,
    boolean indoor,
    boolean needsBooking,
    Set<Vibe> vibes,
    String googleMapsUrl,
    Integer rating,
    PriceRange price,
    int priceFrom,
    Integer spotDurationMin) {

  /** cafe / bar / restaurant, hoặc nhóm chỗ chơi */
  public String category() {
    return placeType != null ? placeType.name() : spotCategory.name();
  }

  /** Thời lượng gợi ý khi thêm vào plan */
  public int defaultDuration() {
    if (spotCategory != null) return spotDurationMin != null ? spotDurationMin : 90;
    return switch (placeType) {
      case cafe -> 75;
      case bar -> 90;
      case restaurant -> 60;
    };
  }

  /** Giá ước tính VNĐ / người (quán: giữa khoảng của mức giá; chỗ chơi: giá vé thấp nhất) */
  public int estimatedPrice() {
    if (spotCategory != null) return priceFrom;
    return switch (price) {
      case cheap -> 40_000;
      case medium -> 100_000;
      case high -> 275_000;
      case luxury -> 500_000;
    };
  }

  /** Mức hợp với kiểu hẹn: theo loại (0–3) + 3 nếu được gắn nhãn đó */
  public int vibeScore(Vibe vibe) {
    int base = placeType != null ? VibeScores.forPlace(placeType, price, vibe) : VibeScores.forSpot(spotCategory, vibe);
    return base + (vibes.contains(vibe) ? 3 : 0);
  }

  public boolean hasCoordinates() {
    return lat != null && lng != null;
  }

  /** Đang mở lúc {@code t}; đóng sau nửa đêm (close &lt; open) vẫn tính đúng. */
  public boolean openAt(LocalTime t) {
    if (open == null || close == null || open.equals(close)) return true;
    if (open.isBefore(close)) return !t.isBefore(open) && t.isBefore(close);
    return !t.isBefore(open) || t.isBefore(close);
  }
}
