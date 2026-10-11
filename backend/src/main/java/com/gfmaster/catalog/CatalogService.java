package com.gfmaster.catalog;

import com.gfmaster.catalog.CatalogDtos.CatalogItem;
import com.gfmaster.catalog.CatalogDtos.CatalogPage;
import com.gfmaster.catalog.CatalogDtos.DistrictOption;
import com.gfmaster.place.PlaceRepository;
import com.gfmaster.place.PlaceType;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Đọc "Khám phá quán": tìm theo tên/địa chỉ, lọc loại và quận, phân trang. */
@Service
public class CatalogService {

  static final int MAX_PAGE_SIZE = 100;

  private final CatalogPlaceRepository catalog;
  private final PlaceRepository places;

  public CatalogService(CatalogPlaceRepository catalog, PlaceRepository places) {
    this.catalog = catalog;
    this.places = places;
  }

  public List<DistrictOption> districts() {
    return Arrays.stream(CatalogDistrict.values()).map(d -> new DistrictOption(d.name(), d.label())).toList();
  }

  /** {@code ownerId}: chủ dữ liệu (admin), để đánh dấu quán đã có trong sổ tay. */
  @Transactional(readOnly = true)
  public CatalogPage search(
      UUID ownerId, String q, PlaceType type, CatalogDistrict district, int page, int size) {
    int pageSize = Math.clamp(size, 1, MAX_PAGE_SIZE);
    Page<CatalogPlace> result =
        catalog.findAll(
            filter(q, type, district),
            PageRequest.of(Math.max(page, 0), pageSize, Sort.by("name").and(Sort.by("id"))));
    List<UUID> ids = result.getContent().stream().map(CatalogPlace::getId).toList();
    Set<UUID> inNotebook =
        ids.isEmpty() ? Set.of() : new HashSet<>(places.findCatalogIdsInNotebook(ownerId, ids));
    List<CatalogItem> items =
        result.getContent().stream().map(c -> toItem(c, inNotebook.contains(c.getId()))).toList();
    return new CatalogPage(items, result.getTotalElements(), result.getNumber(), pageSize, catalog.lastFetchedAt());
  }

  private static Specification<CatalogPlace> filter(String q, PlaceType type, CatalogDistrict district) {
    Specification<CatalogPlace> spec = (root, query, cb) -> cb.conjunction();
    if (type != null) spec = spec.and((root, query, cb) -> cb.equal(root.get("type"), type));
    if (district != null) spec = spec.and((root, query, cb) -> cb.equal(root.get("district"), district.name()));
    if (q != null && !q.isBlank()) {
      String like = "%" + q.trim().toLowerCase(Locale.ROOT).replace("%", "\\%").replace("_", "\\_") + "%";
      spec =
          spec.and(
              (root, query, cb) ->
                  cb.or(
                      cb.like(cb.lower(root.get("name")), like, '\\'),
                      cb.like(cb.lower(cb.coalesce(root.get("address"), "")), like, '\\')));
    }
    return spec;
  }

  private static CatalogItem toItem(CatalogPlace c, boolean inNotebook) {
    String district = c.getDistrict() == null ? null : CatalogDistrict.valueOf(c.getDistrict()).label();
    return new CatalogItem(
        c.getId(),
        c.getType(),
        c.getName(),
        c.getAddress(),
        district,
        c.getLat(),
        c.getLng(),
        c.getOpeningHours(),
        c.getCuisine(),
        c.getPhone(),
        c.getWebsite(),
        c.getHasWifi(),
        inNotebook);
  }
}
