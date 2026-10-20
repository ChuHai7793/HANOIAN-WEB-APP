package com.gfmaster.catalog;

import com.gfmaster.place.PlaceType;
import com.gfmaster.vibe.Vibe;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;

/**
 * Bộ lọc Khám phá quán. Danh sách rỗng / null = không lọc theo mục đó.
 *
 * @param priceMin giá mỗi người (VNĐ) từ mức này: quán có khoảng giá giao với [priceMin, priceMax]; quán chưa
 *     nhập giá cụ thể bị loại khi lọc theo tiền
 * @param priceMax giá mỗi người (VNĐ) đến mức này
 * @param minStars HANOIVIBE chấm từ mức này trở lên
 * @param cuisines loại món (chỉ quán ăn có), khớp một trong số đó
 * @param vibes kiểu hẹn, khớp một trong số đó
 * @param openAt giờ của người xem (client gửi): chỉ quán đang mở lúc đó
 */
public record CatalogFilter(
    String q,
    PlaceType type,
    CatalogDistrict district,
    Integer priceMin,
    Integer priceMax,
    Integer minStars,
    Set<String> cuisines,
    Set<Vibe> vibes,
    LocalTime openAt,
    boolean wifi,
    boolean parking) {

  public CatalogFilter {
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
      Integer priceMin,
      Integer priceMax,
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
        priceMin,
        priceMax,
        minStars,
        cuisines == null ? null : Set.copyOf(cuisines),
        vibes == null ? null : Set.copyOf(vibes),
        openAt,
        Boolean.TRUE.equals(wifi),
        Boolean.TRUE.equals(parking));
  }

  public CatalogFilter withType(PlaceType t) {
    return new CatalogFilter(q, t, district, priceMin, priceMax, minStars, cuisines, vibes, openAt, wifi, parking);
  }
}
