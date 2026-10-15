package com.gfmaster.place;

import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.error.ErrorCode;
import com.gfmaster.common.messaging.DomainEvent.EntityChanged;
import com.gfmaster.common.messaging.DomainEvent.EntityChanged.Action;
import com.gfmaster.common.messaging.DomainEvent.EntityChanged.Entity;
import com.gfmaster.common.messaging.DomainEventPublisher;
import com.gfmaster.common.web.Patch;
import com.gfmaster.maps.GmapUrlParser;
import com.gfmaster.place.dto.PlacePatch;
import com.gfmaster.place.dto.PlaceRequest;
import com.gfmaster.place.dto.PlaceResponse;
import com.gfmaster.upload.storage.ImageUrls;
import com.gfmaster.user.UserRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class PlaceService {

  private final PlaceRepository places;
  private final UserRepository users;
  private final PlaceMapper mapper;
  private final DomainEventPublisher events;
  private final ImageUrls imageUrls;
  private final NamedParameterJdbcTemplate jdbc;

  public PlaceService(
      PlaceRepository places,
      UserRepository users,
      PlaceMapper mapper,
      DomainEventPublisher events,
      ImageUrls imageUrls,
      NamedParameterJdbcTemplate jdbc) {
    this.places = places;
    this.users = users;
    this.mapper = mapper;
    this.events = events;
    this.imageUrls = imageUrls;
    this.jdbc = jdbc;
  }

  @Transactional(readOnly = true)
  public List<PlaceResponse> list(UUID userId, PlaceType type) {
    List<Place> result =
        type == null
            ? places.findAllByUserIdOrderByCreatedAtDesc(userId)
            : places.findAllByUserIdAndTypeOrderByCreatedAtDesc(userId, type);
    Map<UUID, List<String>> photos = catalogPhotos(result.stream().map(Place::getCatalogId).filter(Objects::nonNull).toList());
    return result.stream()
        .map(p -> {
          PlaceResponse r = mapper.toResponse(p);
          List<String> extra = p.getCatalogId() == null ? null : photos.get(p.getCatalogId());
          return extra == null ? r : withPhotos(r, extra);
        })
        .toList();
  }

  private static PlaceResponse withPhotos(PlaceResponse r, List<String> photos) {
    return new PlaceResponse(
        r.id(), r.type(), r.name(), r.address(), r.priceRange(), r.rating(), r.openTime(), r.closeTime(), r.imageUrl(),
        r.note(), r.googleMapsUrl(), r.lat(), r.lng(), r.hasWifi(), r.hasParking(), r.cuisine(), r.version(),
        r.createdAt(), r.updatedAt(), photos, r.catalogId());
  }

  /** Ảnh của các quán gốc trong Khám phá quán (một truy vấn cho cả danh sách), dạng trả về. */
  private Map<UUID, List<String>> catalogPhotos(List<UUID> catalogIds) {
    Map<UUID, List<String>> out = new HashMap<>();
    if (catalogIds.isEmpty()) return out;
    jdbc.query(
        "SELECT catalog_id, url FROM catalog_photos WHERE catalog_id IN (:ids) ORDER BY catalog_id, position",
        Map.of("ids", catalogIds),
        rs -> {
          out.computeIfAbsent(rs.getObject("catalog_id", UUID.class), k -> new ArrayList<>())
              .add(imageUrls.toPublic(rs.getString("url")));
        });
    return out;
  }

  @Transactional(readOnly = true)
  public PlaceResponse get(UUID userId, UUID id) {
    return mapper.toResponse(load(userId, id));
  }

  public PlaceResponse create(UUID userId, PlaceRequest request) {
    Place place = mapper.toEntity(request);
    place.setUser(users.getReferenceById(userId));
    normalizeTypeFields(place);
    fillCoordinatesFromLink(place);
    // Client gửi lại URL công khai (có thể là CDN) → lưu dạng /uploads/<key>
    place.setImageUrl(imageUrls.toStored(place.getImageUrl()));
    Place saved = places.saveAndFlush(place);
    changed(userId, saved.getId(), Action.created);
    return mapper.toResponse(saved);
  }

  public PlaceResponse update(UUID userId, UUID id, Patch<PlacePatch> patch) {
    Place place = load(userId, id);
    if (!Objects.equals(place.getVersion(), patch.value().version())) {
      throw new ApiException(ErrorCode.VERSION_CONFLICT).with("current", mapper.toResponse(place));
    }
    mapper.apply(patch, place);
    normalizeTypeFields(place);
    fillCoordinatesFromLink(place);
    // Client gửi lại URL công khai (có thể là CDN) → lưu dạng /uploads/<key>
    place.setImageUrl(imageUrls.toStored(place.getImageUrl()));
    // Hibernate tăng version lúc flush; nếu có transaction khác vừa ghi thì ném OptimisticLock → 409
    Place saved = places.saveAndFlush(place);
    changed(userId, id, Action.updated);
    return mapper.toResponse(saved);
  }

  public void delete(UUID userId, UUID id) {
    // place_links bị DB xoá theo (ON DELETE CASCADE)
    if (places.deleteByIdAndUserId(id, userId) == 0) {
      throw ApiException.notFound();
    }
    changed(userId, id, Action.deleted);
  }

  /**
   * "Add vào My place": sao chép một quán của "Khám phá quán" vào places của {@code userId} (admin hay
   * guest đều được, mỗi người My place riêng). Đã có rồi thì 409 ALREADY_IN_MY_PLACE.
   */
  public PlaceResponse copyFromCatalog(UUID userId, UUID catalogId, PlaceRequest values) {
    if (places.existsByUserIdAndCatalogId(userId, catalogId)) {
      throw new ApiException(ErrorCode.ALREADY_IN_MY_PLACE);
    }
    Place place = mapper.toEntity(values);
    place.setUser(users.getReferenceById(userId));
    place.setCatalogId(catalogId);
    normalizeTypeFields(place);
    fillCoordinatesFromLink(place);
    // Hai request song song cùng lọt qua bước kiểm tra: uk_places_user_catalog → 409
    Place saved = places.saveAndFlush(place);
    changed(userId, saved.getId(), Action.created);
    return mapper.toResponse(saved);
  }

  /** Admin sửa quán trong danh mục: cập nhật mọi bản sao trong My place của mọi người. */
  public void syncCatalogCopies(UUID catalogId, PlaceRequest values) {
    for (Place place : places.findAllByCatalogId(catalogId)) {
      mapper.overwrite(values, place);
      normalizeTypeFields(place);
      fillCoordinatesFromLink(place);
      changed(place.getUser().getId(), place.getId(), Action.updated);
    }
  }

  /** Gửi sau commit; hiện dùng để xoá cache /stats (đổi loại quán cũng làm số đếm thay đổi). */
  private void changed(UUID userId, UUID id, Action action) {
    events.publish(new EntityChanged(userId, Entity.place, id, action));
  }

  private Place load(UUID userId, UUID id) {
    return places.findByIdAndUserId(id, userId).orElseThrow(ApiException::notFound);
  }

  /** Có link Google Maps đầy đủ mà chưa có toạ độ thì đọc từ link (không gọi mạng). */
  private static void fillCoordinatesFromLink(Place place) {
    if (place.getLat() != null || place.getLng() != null) return;
    GmapUrlParser.parse(place.getGoogleMapsUrl())
        .ifPresent(
            c -> {
              place.setLat(BigDecimal.valueOf(c.lat()).setScale(6, RoundingMode.HALF_UP));
              place.setLng(BigDecimal.valueOf(c.lng()).setScale(6, RoundingMode.HALF_UP));
            });
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
