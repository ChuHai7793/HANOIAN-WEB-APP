package com.gfmaster.placelink;

import com.gfmaster.common.web.MapperConfigDefaults;
import com.gfmaster.common.web.Patch;
import com.gfmaster.place.PlaceMapper;
import com.gfmaster.placelink.dto.LinkedPlaceResponse;
import com.gfmaster.placelink.dto.PlaceLinkPatch;
import com.gfmaster.placelink.dto.PlaceLinkResponse;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(config = MapperConfigDefaults.class, uses = PlaceMapper.class)
public interface PlaceLinkMapper {

  @Mapping(target = "girlfriendId", source = "girlfriend.id")
  @Mapping(target = "placeId", source = "place.id")
  @Mapping(target = "placeType", source = "place.type")
  PlaceLinkResponse toResponse(PlaceLink link);

  @Mapping(target = "link", source = "link")
  @Mapping(target = "place", source = "place")
  LinkedPlaceResponse toLinkedPlace(PlaceLink link);

  /** Áp PATCH: ngày đi gần nhất gửi null thì xoá. */
  default void apply(Patch<PlaceLinkPatch> patch, PlaceLink link) {
    PlaceLinkPatch p = patch.value();
    patch
        .set("herRating", p.herRating(), link::setHerRating)
        .setNullable("lastVisitedAt", p.lastVisitedAt(), link::setLastVisitedAt)
        .set("memory", p.memory(), link::setMemory);
  }
}
