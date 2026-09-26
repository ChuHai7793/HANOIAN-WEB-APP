package com.gfmaster.place.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.gfmaster.place.PlaceType;
import com.gfmaster.place.PriceRange;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalTime;

/** Body POST /places. Field chỉ đọc (id, version, createdAt...) bị bỏ qua nếu client gửi kèm. */
@JsonIgnoreProperties({"id", "version", "createdAt", "updatedAt"})
public record PlaceRequest(
    @NotNull PlaceType type,
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
    @Size(max = 50) String cuisine) {

  /** Chặn data URL (base64): ảnh phải upload qua /uploads/image. */
  public static final String IMAGE_URL = "^$|^(https?://|/uploads/).*";
}
