package com.gfmaster.placelink.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/** Không đổi được cặp (girlfriend, place) của một link; muốn đổi thì xoá rồi tạo lại. */
@JsonIgnoreProperties({"id", "createdAt", "updatedAt", "placeType", "girlfriendId", "placeId"})
public record PlaceLinkPatch(
    @Min(1) @Max(5) Integer herRating,
    LocalDate lastVisitedAt,
    @Size(max = 2000) String memory,
    @NotNull Long version) {}
