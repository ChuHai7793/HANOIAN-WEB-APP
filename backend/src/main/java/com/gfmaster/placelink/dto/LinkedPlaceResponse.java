package com.gfmaster.placelink.dto;

import com.gfmaster.place.dto.PlaceResponse;

/** Một quán đã gắn cho người yêu, kèm sẵn thông tin quán (thay cho {@code linkedOf()} ở client). */
public record LinkedPlaceResponse(PlaceLinkResponse link, PlaceResponse place) {}
