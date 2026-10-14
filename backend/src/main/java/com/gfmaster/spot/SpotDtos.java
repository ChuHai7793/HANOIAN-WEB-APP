package com.gfmaster.spot;

import com.gfmaster.catalog.CatalogDistrict;
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

public final class SpotDtos {

  private SpotDtos() {}

  /**
   * Admin thêm (POST) hoặc sửa (PUT) chỗ chơi: gửi đủ mọi field. {@code openTime}/{@code closeTime}: cùng
   * null (không có giờ cố định) hoặc cùng có. {@code needsBooking} bỏ trống = không cần đặt. {@code version}: bỏ qua khi thêm; khi sửa phải gửi version
   * đã đọc (lệch → 409 VERSION_CONFLICT).
   */
  public record SpotRequest(
      @NotNull SpotCategory category,
      @NotNull CatalogDistrict district,
      @NotBlank @Size(max = 120) String name,
      @Size(max = 255) String address,
      @Size(max = 2000) String description,
      @Min(0) @Max(100_000_000) int priceFrom,
      @Min(0) @Max(100_000_000) Integer priceTo,
      LocalTime openTime,
      LocalTime closeTime,
      @Size(max = 255) String hoursNote,
      @Min(15) @Max(1440) Integer durationMin,
      @NotNull Boolean indoor,
      Boolean needsBooking,
      @Size(max = 2048) @Pattern(regexp = "^$|^https?://.*", message = "Chỉ nhận URL http(s)") String bookingUrl,
      @Size(max = 1024) @Pattern(regexp = PlaceRequest.IMAGE_URL, message = "Chỉ nhận URL http(s) hoặc /uploads/")
          String imageUrl,
      @Size(max = 2048) String googleMapsUrl,
      @DecimalMin("-90") @DecimalMax("90") BigDecimal lat,
      @DecimalMin("-180") @DecimalMax("180") BigDecimal lng,
      /** Ảnh (tối đa 6, ảnh đầu là ảnh bìa); null = chỉ dùng imageUrl như trước */
      @Size(max = 6)
          List<@Size(max = 1024) @Pattern(regexp = PlaceRequest.IMAGE_URL, message = "Chỉ nhận URL http(s) hoặc /uploads/") String>
              photos,
      /** Nhãn kiểu hẹn admin chọn; null = giữ như cũ. Gửi lại đúng nhãn đang có thì không đổi nguồn. */
      Set<Vibe> vibes,
      /** true = bỏ nhãn admin, để hệ thống tự gán theo loại */
      Boolean vibesAuto,
      Long version) {}

  /** Một chỗ chơi. {@code district}: mã quận; {@code districtLabel}: tên hiển thị. */
  public record SpotItem(
      UUID id,
      SpotCategory category,
      String district,
      String districtLabel,
      String name,
      String address,
      String description,
      int priceFrom,
      Integer priceTo,
      LocalTime openTime,
      LocalTime closeTime,
      String hoursNote,
      Integer durationMin,
      boolean indoor,
      boolean needsBooking,
      String bookingUrl,
      String imageUrl,
      String googleMapsUrl,
      BigDecimal lat,
      BigDecimal lng,
      /** Mọi ảnh, ảnh đầu = imageUrl */
      List<String> photos,
      /** Nhãn kiểu hẹn, theo thứ tự chill, active, romantic */
      List<Vibe> vibes,
      /** default | claude | admin */
      String vibesSource,
      Long version,
      Instant createdAt,
      Instant updatedAt,
      /** Người đang xem đã lưu vào My place chưa (false ở kết quả thêm / sửa của admin) */
      boolean inMyPlace,
      /** Điểm đánh giá trung bình (1 chữ số thập phân); null = chưa có đánh giá */
      BigDecimal ratingAvg,
      int ratingCount) {}

  public record SpotPage(List<SpotItem> items, long total, int page, int size) {}
}
