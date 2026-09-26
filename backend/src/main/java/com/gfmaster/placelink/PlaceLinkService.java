package com.gfmaster.placelink;

import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.error.ErrorCode;
import com.gfmaster.common.web.Patch;
import com.gfmaster.girlfriend.Girlfriend;
import com.gfmaster.girlfriend.GirlfriendRepository;
import com.gfmaster.place.Place;
import com.gfmaster.place.PlaceRepository;
import com.gfmaster.place.PlaceType;
import com.gfmaster.placelink.dto.LinkedPlaceResponse;
import com.gfmaster.placelink.dto.PlaceLinkPatch;
import com.gfmaster.placelink.dto.PlaceLinkRequest;
import com.gfmaster.placelink.dto.PlaceLinkResponse;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class PlaceLinkService {

  private final PlaceLinkRepository links;
  private final GirlfriendRepository girlfriends;
  private final PlaceRepository places;
  private final PlaceLinkMapper mapper;

  public PlaceLinkService(
      PlaceLinkRepository links,
      GirlfriendRepository girlfriends,
      PlaceRepository places,
      PlaceLinkMapper mapper) {
    this.links = links;
    this.girlfriends = girlfriends;
    this.places = places;
    this.mapper = mapper;
  }

  /** Lọc tuỳ chọn theo girlfriendId hoặc placeId; không lọc thì trả mọi link của user. */
  @Transactional(readOnly = true)
  public List<PlaceLinkResponse> list(UUID userId, UUID girlfriendId, UUID placeId) {
    List<PlaceLink> result;
    if (girlfriendId != null) {
      result = links.findAllByGirlfriendIdAndGirlfriendUserId(girlfriendId, userId);
    } else if (placeId != null) {
      result = links.findAllByPlaceIdAndGirlfriendUserId(placeId, userId);
    } else {
      result = links.findAllByGirlfriendUserIdOrderByCreatedAtDesc(userId);
    }
    return result.stream().map(mapper::toResponse).toList();
  }

  /** Các quán đã gắn cho một người yêu, join sẵn place, nàng chấm cao đứng trước. */
  @Transactional(readOnly = true)
  public List<LinkedPlaceResponse> linkedPlaces(UUID userId, UUID girlfriendId, PlaceType type) {
    if (!girlfriends.existsByIdAndUserId(girlfriendId, userId)) {
      throw ApiException.notFound();
    }
    return links.findAllByGirlfriendIdAndGirlfriendUserId(girlfriendId, userId).stream()
        .filter(l -> type == null || l.getPlace().getType() == type)
        .sorted(
            Comparator.comparingInt(PlaceLink::getHerRating)
                .reversed()
                .thenComparing(PlaceLink::getLastVisitedAt, Comparator.nullsLast(Comparator.reverseOrder())))
        .map(mapper::toLinkedPlace)
        .toList();
  }

  public PlaceLinkResponse create(UUID userId, PlaceLinkRequest request) {
    // Cả người yêu lẫn quán đều phải thuộc user hiện tại (chống gắn chéo dữ liệu người khác)
    Girlfriend gf =
        girlfriends.findByIdAndUserId(request.girlfriendId(), userId).orElseThrow(ApiException::notFound);
    Place place = places.findByIdAndUserId(request.placeId(), userId).orElseThrow(ApiException::notFound);

    PlaceLink link = new PlaceLink();
    link.setGirlfriend(gf);
    link.setPlace(place);
    link.setHerRating(request.herRating());
    link.setLastVisitedAt(request.lastVisitedAt());
    link.setMemory(request.memory() == null ? "" : request.memory());
    // Trùng cặp (girlfriend, place) → uk_link_gf_place → 409 LINK_ALREADY_EXISTS
    return mapper.toResponse(links.saveAndFlush(link));
  }

  public PlaceLinkResponse update(UUID userId, UUID id, Patch<PlaceLinkPatch> patch) {
    PlaceLink link = links.findByIdAndGirlfriendUserId(id, userId).orElseThrow(ApiException::notFound);
    if (!Objects.equals(link.getVersion(), patch.value().version())) {
      throw new ApiException(ErrorCode.VERSION_CONFLICT).with("current", mapper.toResponse(link));
    }
    mapper.apply(patch, link);
    return mapper.toResponse(links.saveAndFlush(link));
  }

  public void delete(UUID userId, UUID id) {
    if (links.deleteByIdAndGirlfriendUserId(id, userId) == 0) {
      throw ApiException.notFound();
    }
  }
}
