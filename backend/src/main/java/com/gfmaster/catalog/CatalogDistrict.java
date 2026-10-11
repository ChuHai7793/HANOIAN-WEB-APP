package com.gfmaster.catalog;

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
}
