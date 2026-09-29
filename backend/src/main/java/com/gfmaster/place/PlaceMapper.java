package com.gfmaster.place;

import com.gfmaster.common.web.MapperConfigDefaults;
import com.gfmaster.common.web.Patch;
import com.gfmaster.place.dto.PlacePatch;
import com.gfmaster.place.dto.PlaceRequest;
import com.gfmaster.place.dto.PlaceResponse;
import com.gfmaster.upload.storage.ImageUrls;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(config = MapperConfigDefaults.class, uses = ImageUrls.class)
public interface PlaceMapper {

  /** Ảnh lưu dạng /uploads/<key> được đổi thành URL công khai (local hoặc CDN). */
  @Mapping(target = "imageUrl", qualifiedByName = "publicUrl")
  PlaceResponse toResponse(Place place);

  @Mapping(target = "id", ignore = true)
  @Mapping(target = "user", ignore = true)
  @Mapping(target = "version", ignore = true)
  @Mapping(target = "createdAt", ignore = true)
  @Mapping(target = "updatedAt", ignore = true)
  @Mapping(target = "address", defaultValue = "")
  @Mapping(target = "imageUrl", defaultValue = "")
  @Mapping(target = "note", defaultValue = "")
  @Mapping(target = "googleMapsUrl", defaultValue = "")
  Place toEntity(PlaceRequest request);

  /** Áp PATCH: field vắng mặt giữ nguyên; toạ độ/tiện ích/ẩm thực gửi null thì xoá. */
  default void apply(Patch<PlacePatch> patch, Place place) {
    PlacePatch p = patch.value();
    patch
        .set("type", p.type(), place::setType)
        .set("name", p.name(), place::setName)
        .set("address", p.address(), place::setAddress)
        .set("priceRange", p.priceRange(), place::setPriceRange)
        .set("rating", p.rating(), place::setRating)
        .set("openTime", p.openTime(), place::setOpenTime)
        .set("closeTime", p.closeTime(), place::setCloseTime)
        .set("imageUrl", p.imageUrl(), place::setImageUrl)
        .set("note", p.note(), place::setNote)
        .set("googleMapsUrl", p.googleMapsUrl(), place::setGoogleMapsUrl)
        .setNullable("lat", p.lat(), place::setLat)
        .setNullable("lng", p.lng(), place::setLng)
        .setNullable("hasWifi", p.hasWifi(), place::setHasWifi)
        .setNullable("hasParking", p.hasParking(), place::setHasParking)
        .setNullable("cuisine", p.cuisine(), place::setCuisine);
  }
}
