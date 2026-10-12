package com.gfmaster.catalog;

import com.gfmaster.place.PlaceType;
import com.gfmaster.place.PriceRange;
import com.gfmaster.place.dto.PlaceRequest;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

public final class CatalogDtos {

  private CatalogDtos() {}

  public record DistrictOption(String code, String label) {}

  /**
   * Admin thêm (POST) hoặc sửa (PUT) quán trong danh mục: gửi đủ mọi field. {@code version}: bỏ qua khi
   * thêm; khi sửa phải gửi version đã đọc (lệch → 409 VERSION_CONFLICT).
   */
  public record CatalogRequest(
      @NotNull PlaceType type,
      @NotNull CatalogDistrict district,
      @NotBlank @Size(max = 120) String name,
      @Size(max = 255) String address,
      @NotNull PriceRange priceRange,
      @Min(1) @Max(5) int rating,
      @NotNull LocalTime openTime,
      @NotNull LocalTime closeTime,
      @Size(max = 1024) @Pattern(regexp = PlaceRequest.IMAGE_URL, message = "Chỉ nhận URL http(s) hoặc /uploads/")
          String imageUrl,
      @Size(max = 2000) String note,
      @Size(max = 2048) String googleMapsUrl,
      @DecimalMin("-90") @DecimalMax("90") BigDecimal lat,
      @DecimalMin("-180") @DecimalMax("180") BigDecimal lng,
      Boolean hasWifi,
      Boolean hasParking,
      @Size(max = 50) String cuisine,
      Long version) {}

  /**
   * Một quán trong "Khám phá quán". {@code district}: mã quận; {@code districtLabel}: tên hiển thị.
   * {@code inMyPlace}: người đang xem đã add quán này vào My place chưa. {@code fans}: số "người hợp gu đã
   * lưu" (người có thể hiện trên thẻ Tìm đối tượng của người xem); null khi người xem chưa bật Tìm đối tượng
   * hoặc không phải danh sách tìm kiếm (thêm/sửa).
   */
  public record CatalogItem(
      UUID id,
      PlaceType type,
      String district,
      String districtLabel,
      String name,
      String address,
      PriceRange priceRange,
      int rating,
      LocalTime openTime,
      LocalTime closeTime,
      String imageUrl,
      String note,
      String googleMapsUrl,
      BigDecimal lat,
      BigDecimal lng,
      Boolean hasWifi,
      Boolean hasParking,
      String cuisine,
      Long version,
      Instant createdAt,
      Instant updatedAt,
      boolean inMyPlace,
      Integer fans) {}

  public record CatalogPage(List<CatalogItem> items, long total, int page, int size) {}
}
