package com.gfmaster.girlfriend.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.gfmaster.girlfriend.RelationshipStatus;
import com.gfmaster.place.dto.PlaceRequest;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;

@JsonIgnoreProperties({"id", "version", "createdAt", "updatedAt", "placeCount"})
public record GirlfriendRequest(
    @NotBlank @Size(max = 80) String name,
    @Size(max = 80) String nickname,
    @Size(max = 1024) @Pattern(regexp = PlaceRequest.IMAGE_URL, message = "Chỉ nhận URL http(s) hoặc /uploads/")
        String avatarUrl,
    LocalDate birthday,
    @Size(max = 20) String phone,
    RelationshipStatus status,
    LocalDate startedDate,
    @Size(max = 20) List<@NotBlank @Size(max = 50) String> hobbies,
    @Size(max = 2000) String note) {}
