package com.gfmaster.catalog;

import com.gfmaster.place.PlaceType;
import com.gfmaster.place.PriceRange;
import com.gfmaster.place.dto.PlaceRequest;
import com.gfmaster.vibe.Vibe;
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
import java.util.Set;
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
      /** Giá cụ thể VNĐ/người (null = chưa nhập); priceTo null = chỉ có giá từ */
      @Min(0) @Max(100_000_000) Integer priceFrom,
      @Min(0) @Max(100_000_000) Integer priceTo,
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
      /** Ảnh (tối đa 6, ảnh đầu là ảnh bìa); null = chỉ dùng imageUrl như trước */
      @Size(max = 6, message = "Tối đa 6 ảnh")
          List<@Size(max = 1024) @Pattern(regexp = PlaceRequest.IMAGE_URL, message = "Chỉ nhận URL http(s) hoặc /uploads/") String>
              photos,
      /** Nhãn kiểu hẹn admin chọn; null = giữ như cũ. Gửi lại đúng nhãn đang có thì không đổi nguồn. */
      Set<Vibe> vibes,
      /** true = bỏ nhãn admin, để hệ thống tự gán theo loại */
      Boolean vibesAuto,
      Long version) {}

  /**
   * Một quán trong "Khám phá quán". {@code district}: mã quận; {@code districtLabel}: tên hiển thị.
   * {@code inMyPlace}: người đang xem đã add quán này vào My place chưa. {@code fans}: số "người hợp gu đã
   * lưu" (người có thể hiện trên thẻ Tìm đối tượng của người xem); null khi người xem chưa bật Tìm đối tượng
   * hoặc không phải danh sách tìm kiếm (thêm/sửa).
   */
  public record CatalogItem(
      UUID id,
      /** Đường dẫn trang riêng: /quan/{slug} hoặc /cho-choi/{slug} */
      String slug,
      PlaceType type,
      String district,
      String districtLabel,
      String name,
      String address,
      PriceRange priceRange,
      /** Giá cụ thể VNĐ/người; null = chưa nhập */
      Integer priceFrom,
      Integer priceTo,
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
      /** Mọi ảnh, ảnh đầu = imageUrl */
      List<String> photos,
      /** Nhãn kiểu hẹn, theo thứ tự chill, active, romantic */
      List<Vibe> vibes,
      /** default | claude | admin */
      String vibesSource,
      Long version,
      Instant createdAt,
      Instant updatedAt,
      boolean inMyPlace,
      Integer fans,
      /** Điểm đánh giá trung bình (1 chữ số thập phân); null = chưa có đánh giá */
      BigDecimal ratingAvg,
      int ratingCount) {}

  /** Một điểm hẹn nổi bật: vị trí 1..6, dòng nhỏ, câu dẫn và quán */
  public record FeaturedItem(int position, String kicker, String headline, CatalogItem place) {}

  /** Admin chọn một điểm hẹn nổi bật (thứ tự trong danh sách là vị trí) */
  public record FeaturedRequest(
      @NotNull UUID catalogId,
      @Size(max = 60) String kicker,
      @NotBlank @Size(max = 120) String headline) {}

  /** Ảnh nền banner Khám phá quán; null = frontend dùng ảnh mặc định */
  public record BannerSetting(
      @Size(max = 1024) @Pattern(regexp = PlaceRequest.IMAGE_URL, message = "Chỉ nhận URL http(s) hoặc /uploads/") String imageUrl) {}

  public record CatalogPage(List<CatalogItem> items, long total, int page, int size) {}
}
