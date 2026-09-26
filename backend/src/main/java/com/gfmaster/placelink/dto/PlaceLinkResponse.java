package com.gfmaster.placelink.dto;

import com.gfmaster.place.PlaceType;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record PlaceLinkResponse(
    UUID id,
    UUID girlfriendId,
    UUID placeId,
    PlaceType placeType,
    int herRating,
    LocalDate lastVisitedAt,
    String memory,
    Long version,
    Instant createdAt,
    Instant updatedAt) {}
