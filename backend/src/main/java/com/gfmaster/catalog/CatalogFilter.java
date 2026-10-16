package com.gfmaster.catalog;

import com.gfmaster.place.PlaceType;
import com.gfmaster.place.PriceRange;
import com.gfmaster.vibe.Vibe;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;

/**
 * Bộ lọc Khám phá quán. Danh sách rỗng / null = không lọc theo mục đó.
 *
 * @param prices nhóm giá (chọn nhiều, khớp một trong số đó)
 * @param budget ngân sách VNĐ/người: giá thấp nhất của quán không vượt mức này (quán chưa có giá cụ thể lấy mức
 *     thấp nhất của nhóm giá)
 * @param minStars HANOIVIBE chấm từ mức này trở lên
 * @param cuisines loại món (chỉ quán ăn có), khớp một trong số đó
 * @param vibes kiểu hẹn, khớp một trong số đó
 * @param openAt giờ của người xem (client gửi): chỉ quán đang mở lúc đó
 */
public record CatalogFilter(
    String q,
    PlaceType type,
    CatalogDistrict district,
    Set<PriceRange> prices,
    Integer budget,
    Integer minStars,
    Set<String> cuisines,
    Set<Vibe> vibes,
    LocalTime openAt,
    boolean wifi,
    boolean parking) {

  public CatalogFilter {
    prices = prices == null ? Set.of() : Set.copyOf(prices);
    cuisines = cuisines == null ? Set.of() : Set.copyOf(cuisines.stream().map(String::trim).filter(c -> !c.isEmpty()).toList());
    vibes = vibes == null ? Set.of() : Set.copyOf(vibes);
  }

  public static CatalogFilter of(String q, PlaceType type, CatalogDistrict district) {
    return new CatalogFilter(q, type, district, null, null, null, null, null, null, false, false);
  }

  /** Từ tham số request (danh sách có thể null) */
  public static CatalogFilter of(
      String q,
      PlaceType type,
      CatalogDistrict district,
      List<PriceRange> prices,
      Integer budget,
      Integer minStars,
      List<String> cuisines,
      List<Vibe> vibes,
      LocalTime openAt,
      Boolean wifi,
      Boolean parking) {
    return new CatalogFilter(
        q,
        type,
        district,
        prices == null ? null : Set.copyOf(prices),
        budget,
        minStars,
        cuisines == null ? null : Set.copyOf(cuisines),
        vibes == null ? null : Set.copyOf(vibes),
        openAt,
        Boolean.TRUE.equals(wifi),
        Boolean.TRUE.equals(parking));
  }

  public CatalogFilter withType(PlaceType t) {
    return new CatalogFilter(q, t, district, prices, budget, minStars, cuisines, vibes, openAt, wifi, parking);
  }
}
