package com.gfmaster.catalog;

import com.gfmaster.catalog.CatalogDtos.CatalogItem;
import com.gfmaster.catalog.CatalogDtos.CatalogPage;
import com.gfmaster.catalog.CatalogDtos.CatalogRequest;
import com.gfmaster.catalog.CatalogDtos.DistrictOption;
import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.error.ErrorCode;
import com.gfmaster.dating.DatingRepository;
import com.gfmaster.place.PlaceRepository;
import com.gfmaster.place.PlaceService;
import com.gfmaster.place.PlaceType;
import com.gfmaster.place.dto.PlaceRequest;
import com.gfmaster.place.dto.PlaceResponse;
import com.gfmaster.upload.storage.ImageUrls;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * "Khám phá quán": admin thêm/sửa/xoá; mọi người tìm, lọc theo loại và khu vực, và "Add vào My place"
 * (sao chép quán vào places của chính mình). Sửa quán thì cập nhật luôn mọi bản sao trong My place.
 */
@Service
@Transactional
public class CatalogService {

  static final int MAX_PAGE_SIZE = 100;

  private final CatalogPlaceRepository catalog;
  private final PlaceRepository places;
  private final PlaceService placeService;
  private final ImageUrls imageUrls;
  private final DatingRepository dating;

  public CatalogService(
      CatalogPlaceRepository catalog,
      PlaceRepository places,
      PlaceService placeService,
      ImageUrls imageUrls,
      DatingRepository dating) {
    this.catalog = catalog;
    this.places = places;
    this.placeService = placeService;
    this.imageUrls = imageUrls;
    this.dating = dating;
  }

  @Transactional(readOnly = true)
  public List<DistrictOption> districts() {
    return Arrays.stream(CatalogDistrict.values()).map(d -> new DistrictOption(d.name(), d.label())).toList();
  }

  /**
   * Số quán theo từng loại cho chip lọc ("Cafe · 10"), theo từ khoá và khu vực đang chọn (không theo loại,
   * nếu không chip khác luôn bằng 0). Khoá {@code all} là tổng.
   */
  @Transactional(readOnly = true)
  public Map<String, Long> counts(String q, CatalogDistrict district) {
    Map<String, Long> out = new LinkedHashMap<>();
    out.put("all", catalog.count(filter(q, null, district)));
    for (PlaceType t : PlaceType.values()) out.put(t.name(), catalog.count(filter(q, t, district)));
    return out;
  }

  /** {@code userId}: người đang xem, để đánh dấu quán đã có trong My place của họ. */
  @Transactional(readOnly = true)
  public CatalogPage search(UUID userId, String q, PlaceType type, CatalogDistrict district, int page, int size) {
    int pageSize = Math.clamp(size, 1, MAX_PAGE_SIZE);
    Page<CatalogPlace> result =
        catalog.findAll(
            filter(q, type, district),
            PageRequest.of(Math.max(page, 0), pageSize, Sort.by("name").and(Sort.by("id"))));
    List<UUID> ids = result.getContent().stream().map(CatalogPlace::getId).toList();
    Set<UUID> saved = ids.isEmpty() ? Set.of() : new HashSet<>(places.findCatalogIdsInMyPlace(userId, ids));
    // "Người hợp gu đã lưu": chỉ khi người xem đang bật Tìm đối tượng
    Map<UUID, Integer> fans = dating.canSeeDeck(userId) ? dating.fansOf(userId, ids) : null;
    List<CatalogItem> items =
        result.getContent().stream()
            .map(c -> toItem(c, saved.contains(c.getId()), fans == null ? null : fans.getOrDefault(c.getId(), 0)))
            .toList();
    return new CatalogPage(items, result.getTotalElements(), result.getNumber(), pageSize);
  }

  public CatalogItem create(CatalogRequest req) {
    CatalogPlace c = new CatalogPlace();
    apply(req, c);
    return toItem(catalog.saveAndFlush(c), false, null);
  }

  public CatalogItem update(UUID id, CatalogRequest req) {
    CatalogPlace c = load(id);
    if (!Objects.equals(c.getVersion(), req.version())) {
      throw new ApiException(ErrorCode.VERSION_CONFLICT).with("current", toItem(c, false, null));
    }
    apply(req, c);
    CatalogPlace saved = catalog.saveAndFlush(c);
    placeService.syncCatalogCopies(id, toPlaceRequest(saved));
    return toItem(saved, false, null);
  }

  /** Bản sao trong My place của mọi người vẫn giữ (places.catalog_id thành NULL). */
  public void delete(UUID id) {
    if (!catalog.existsById(id)) throw ApiException.notFound();
    catalog.deleteById(id);
  }

  /** "Add vào My place": vào đúng nhóm theo loại của quán (cafe, bar, quán ăn). */
  public PlaceResponse addToMyPlace(UUID userId, UUID id) {
    CatalogPlace c = load(id);
    return placeService.copyFromCatalog(userId, id, toPlaceRequest(c));
  }

  private CatalogPlace load(UUID id) {
    return catalog.findById(id).orElseThrow(ApiException::notFound);
  }

  private void apply(CatalogRequest r, CatalogPlace c) {
    c.setType(r.type());
    c.setDistrict(r.district());
    c.setName(r.name().trim());
    c.setAddress(r.address() == null ? "" : r.address().trim());
    c.setPriceRange(r.priceRange());
    c.setRating(r.rating());
    c.setOpenTime(r.openTime());
    c.setCloseTime(r.closeTime());
    // Client gửi lại URL công khai (có thể là CDN) → lưu dạng /uploads/<key>
    c.setImageUrl(r.imageUrl() == null ? "" : imageUrls.toStored(r.imageUrl()));
    c.setNote(r.note() == null ? "" : r.note());
    c.setGoogleMapsUrl(r.googleMapsUrl() == null ? "" : r.googleMapsUrl());
    c.setLat(r.lat());
    c.setLng(r.lng());
    // Như My place: quán ăn không có wifi/chỗ đỗ xe, cafe/bar không có loại món
    boolean restaurant = r.type() == PlaceType.restaurant;
    c.setHasWifi(restaurant ? null : r.hasWifi());
    c.setHasParking(restaurant ? null : r.hasParking());
    c.setCuisine(restaurant ? r.cuisine() : null);
  }

  /** Nội dung quán dưới dạng request tạo/ghi đè quán trong My place (ảnh giữ dạng lưu). */
  private static PlaceRequest toPlaceRequest(CatalogPlace c) {
    return new PlaceRequest(
        c.getType(),
        c.getName(),
        c.getAddress(),
        c.getPriceRange(),
        c.getRating(),
        c.getOpenTime(),
        c.getCloseTime(),
        c.getImageUrl(),
        c.getNote(),
        c.getGoogleMapsUrl(),
        c.getLat(),
        c.getLng(),
        c.getHasWifi(),
        c.getHasParking(),
        c.getCuisine());
  }

  private static Specification<CatalogPlace> filter(String q, PlaceType type, CatalogDistrict district) {
    Specification<CatalogPlace> spec = (root, query, cb) -> cb.conjunction();
    if (type != null) spec = spec.and((root, query, cb) -> cb.equal(root.get("type"), type));
    if (district != null) spec = spec.and((root, query, cb) -> cb.equal(root.get("district"), district));
    if (q != null && !q.isBlank()) {
      String like = "%" + q.trim().toLowerCase(Locale.ROOT).replace("%", "\\%").replace("_", "\\_") + "%";
      spec =
          spec.and(
              (root, query, cb) ->
                  cb.or(
                      cb.like(cb.lower(root.get("name")), like, '\\'),
                      cb.like(cb.lower(root.get("address")), like, '\\')));
    }
    return spec;
  }

  private CatalogItem toItem(CatalogPlace c, boolean inMyPlace, Integer fans) {
    return new CatalogItem(
        c.getId(),
        c.getType(),
        c.getDistrict().name(),
        c.getDistrict().label(),
        c.getName(),
        c.getAddress(),
        c.getPriceRange(),
        c.getRating(),
        c.getOpenTime(),
        c.getCloseTime(),
        imageUrls.toPublic(c.getImageUrl()),
        c.getNote(),
        c.getGoogleMapsUrl(),
        c.getLat(),
        c.getLng(),
        c.getHasWifi(),
        c.getHasParking(),
        c.getCuisine(),
        c.getVersion(),
        c.getCreatedAt(),
        c.getUpdatedAt(),
        inMyPlace,
        fans);
  }
}
