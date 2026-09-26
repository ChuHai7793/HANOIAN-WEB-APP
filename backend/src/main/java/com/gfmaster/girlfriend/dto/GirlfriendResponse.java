package com.gfmaster.girlfriend.dto;

import com.gfmaster.girlfriend.RelationshipStatus;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record GirlfriendResponse(
    UUID id,
    String name,
    String nickname,
    String avatarUrl,
    LocalDate birthday,
    String phone,
    RelationshipStatus status,
    LocalDate startedDate,
    List<String> hobbies,
    String note,
    long placeCount,
    Long version,
    Instant createdAt,
    Instant updatedAt) {}
