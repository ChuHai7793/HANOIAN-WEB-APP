package com.gfmaster.catalog;

import com.gfmaster.common.web.Slugs;
import java.util.Arrays;
import java.util.Locale;
import java.util.Optional;

/** Khu vực của quán trong "Khám phá quán": các quận nội thành Hà Nội. Lưu DB bằng tên hằng (BA_DINH...). */
public enum CatalogDistrict {
  BA_DINH("Ba Đình"),
  HOAN_KIEM("Hoàn Kiếm"),
  TAY_HO("Tây Hồ"),
  LONG_BIEN("Long Biên"),
  CAU_GIAY("Cầu Giấy"),
  DONG_DA("Đống Đa"),
  HAI_BA_TRUNG("Hai Bà Trưng"),
  HOANG_MAI("Hoàng Mai"),
  THANH_XUAN("Thanh Xuân"),
  NAM_TU_LIEM("Nam Từ Liêm"),
  BAC_TU_LIEM("Bắc Từ Liêm"),
  HA_DONG("Hà Đông");

  private final String label;

  CatalogDistrict(String label) {
    this.label = label;
  }

  public String label() {
    return label;
  }

  /** Đường dẫn trang hub theo khu vực (SEO): "Cầu Giấy" → {@code cau-giay}. */
  public String slug() {
    return Slugs.of(label, Slugs.MAX_LENGTH, name().toLowerCase(Locale.ROOT));
  }

  /** Khu vực theo slug trên đường dẫn; rỗng nếu không có. */
  public static Optional<CatalogDistrict> fromSlug(String slug) {
    if (slug == null) return Optional.empty();
    return Arrays.stream(values()).filter(d -> d.slug().equals(slug.trim().toLowerCase(Locale.ROOT))).findFirst();
  }
}
