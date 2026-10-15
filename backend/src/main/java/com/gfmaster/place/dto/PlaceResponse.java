package com.gfmaster.place.dto;

import com.gfmaster.place.PlaceType;
import com.gfmaster.place.PriceRange;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

public record PlaceResponse(
    UUID id,
    PlaceType type,
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
    /** Quán sao chép từ Khám phá quán: mọi ảnh của quán gốc (ảnh đầu = imageUrl). Chỉ có ở danh sách My place. */
    List<String> photos,
    /** Quán gốc trong Khám phá quán (plan tham chiếu quán theo id này); null với quán tự nhập cũ */
    UUID catalogId) {}
