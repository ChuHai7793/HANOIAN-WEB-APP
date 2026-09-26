package com.gfmaster.place;

import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.error.ErrorCode;
import com.gfmaster.common.web.Patch;
import com.gfmaster.place.dto.PlacePatch;
import com.gfmaster.place.dto.PlaceRequest;
import com.gfmaster.place.dto.PlaceResponse;
import com.gfmaster.user.UserRepository;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class PlaceService {

  private final PlaceRepository places;
  private final UserRepository users;
  private final PlaceMapper mapper;

  public PlaceService(PlaceRepository places, UserRepository users, PlaceMapper mapper) {
    this.places = places;
    this.users = users;
    this.mapper = mapper;
  }

  @Transactional(readOnly = true)
  public List<PlaceResponse> list(UUID userId, PlaceType type) {
    List<Place> result =
        type == null
            ? places.findAllByUserIdOrderByCreatedAtDesc(userId)
            : places.findAllByUserIdAndTypeOrderByCreatedAtDesc(userId, type);
    return result.stream().map(mapper::toResponse).toList();
  }

  @Transactional(readOnly = true)
  public PlaceResponse get(UUID userId, UUID id) {
    return mapper.toResponse(load(userId, id));
  }

  public PlaceResponse create(UUID userId, PlaceRequest request) {
    Place place = mapper.toEntity(request);
    place.setUser(users.getReferenceById(userId));
    normalizeTypeFields(place);
    return mapper.toResponse(places.saveAndFlush(place));
  }

  public PlaceResponse update(UUID userId, UUID id, Patch<PlacePatch> patch) {
    Place place = load(userId, id);
    if (!Objects.equals(place.getVersion(), patch.value().version())) {
      throw new ApiException(ErrorCode.VERSION_CONFLICT).with("current", mapper.toResponse(place));
    }
    mapper.apply(patch, place);
    normalizeTypeFields(place);
    // Hibernate tăng version lúc flush; nếu có transaction khác vừa ghi thì ném OptimisticLock → 409
    return mapper.toResponse(places.saveAndFlush(place));
  }

  public void delete(UUID userId, UUID id) {
    // place_links bị DB xoá theo (ON DELETE CASCADE)
    if (places.deleteByIdAndUserId(id, userId) == 0) {
      throw ApiException.notFound();
    }
  }

  private Place load(UUID userId, UUID id) {
    return places.findByIdAndUserId(id, userId).orElseThrow(ApiException::notFound);
  }

  /** Quán ăn không có wifi/parking; cafe/bar không có ẩm thực. */
  private static void normalizeTypeFields(Place place) {
    if (place.getType() == PlaceType.restaurant) {
      place.setHasWifi(null);
      place.setHasParking(null);
    } else {
      place.setCuisine(null);
    }
  }
}
