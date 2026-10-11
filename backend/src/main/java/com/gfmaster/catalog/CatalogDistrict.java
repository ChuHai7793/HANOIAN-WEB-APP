package com.gfmaster.catalog;

/**
 * Các quận nội thành Hà Nội để chọn khi nhập. Khung toạ độ (nam, tây, bắc, đông) là <b>gần đúng</b>:
 * hai quận giáp nhau có thể chồng lên một phần, nên quán ở ranh giới có thể mang nhãn quận bên cạnh.
 * Không bị trùng quán vì mỗi quán nhận diện bằng mã OSM ({@code uk_catalog_source}).
 */
public enum CatalogDistrict {
  BA_DINH("Ba Đình", 21.025, 105.805, 21.050, 105.845),
  HOAN_KIEM("Hoàn Kiếm", 21.015, 105.840, 21.040, 105.862),
  TAY_HO("Tây Hồ", 21.045, 105.795, 21.095, 105.850),
  LONG_BIEN("Long Biên", 21.010, 105.860, 21.075, 105.935),
  CAU_GIAY("Cầu Giấy", 21.010, 105.775, 21.050, 105.805),
  DONG_DA("Đống Đa", 20.998, 105.800, 21.032, 105.845),
  HAI_BA_TRUNG("Hai Bà Trưng", 20.990, 105.840, 21.020, 105.875),
  HOANG_MAI("Hoàng Mai", 20.950, 105.825, 20.995, 105.880),
  THANH_XUAN("Thanh Xuân", 20.980, 105.790, 21.005, 105.830),
  NAM_TU_LIEM("Nam Từ Liêm", 20.990, 105.735, 21.045, 105.785),
  BAC_TU_LIEM("Bắc Từ Liêm", 21.040, 105.730, 21.095, 105.800),
  HA_DONG("Hà Đông", 20.940, 105.740, 20.995, 105.800);

  private final String label;
  private final double south;
  private final double west;
  private final double north;
  private final double east;

  CatalogDistrict(String label, double south, double west, double north, double east) {
    this.label = label;
    this.south = south;
    this.west = west;
    this.north = north;
    this.east = east;
  }

  public String label() {
    return label;
  }

  /** Dạng {@code (nam,tây,bắc,đông)} của Overpass QL. */
  public String overpassBbox() {
    return "(%s,%s,%s,%s)".formatted(south, west, north, east);
  }
}
