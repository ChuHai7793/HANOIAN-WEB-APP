package com.gfmaster.placelink.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.UUID;

/** {@code placeType} do server lấy từ place, client gửi kèm thì bỏ qua. */
@JsonIgnoreProperties({"id", "version", "createdAt", "updatedAt", "placeType"})
public record PlaceLinkRequest(
    @NotNull UUID girlfriendId,
    @NotNull UUID placeId,
    @Min(1) @Max(5) int herRating,
    LocalDate lastVisitedAt,
    @Size(max = 2000) String memory) {}
