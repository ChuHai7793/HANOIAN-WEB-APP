package com.gfmaster.catalog;

import com.gfmaster.common.web.Slugs;
import com.gfmaster.catalog.CatalogDtos.BannerSetting;
import com.gfmaster.catalog.CatalogDtos.FeaturedRequest;
import com.gfmaster.catalog.CatalogDtos.FeaturedItem;
import java.util.HashMap;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import com.gfmaster.vibe.VibeDefaults;
import com.gfmaster.vibe.VibeDefaults.Tagged;
import com.gfmaster.catalog.CatalogDtos.CatalogItem;
import com.gfmaster.catalog.CatalogDtos.CatalogPage;
import com.gfmaster.catalog.CatalogDtos.CatalogRequest;
import com.gfmaster.catalog.CatalogDtos.DistrictOption;
import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.jpa.OpenHours;
import com.gfmaster.place.PriceRange;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import com.gfmaster.common.error.ErrorCode;
import com.gfmaster.dating.DatingRepository;
import com.gfmaster.place.PlaceRepository;
import com.gfmaster.place.PlaceService;
import com.gfmaster.place.Place;
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
  private final NamedParameterJdbcTemplate jdbc;

  public CatalogService(
      CatalogPlaceRepository catalog,
      PlaceRepository places,
      PlaceService placeService,
      ImageUrls imageUrls,
      DatingRepository dating,
      NamedParameterJdbcTemplate jdbc) {
    this.catalog = catalog;
    this.places = places;
    this.placeService = placeService;
    this.imageUrls = imageUrls;
    this.dating = dating;
    this.jdbc = jdbc;
  }

  /** Gán đường dẫn trang riêng cho quán mới (giữ nguyên khi đổi tên sau này) */
  CatalogPlace withSlug(CatalogPlace c) {
    if (c.getSlug() == null) c.setSlug(Slugs.unique(c.getName(), "quan", catalog::existsBySlug));
    return c;
  }

  /** Trang riêng của quán: /quan/{slug}. Công khai; có "đã lưu" / "người hợp gu" nếu đã đăng nhập. */
  @Transactional(readOnly = true)
  public CatalogItem bySlug(UUID userId, String slug) {
    CatalogPlace c = catalog.findBySlug(slug).orElseThrow(ApiException::notFound);
    List<UUID> ids = List.of(c.getId());
    boolean saved = userId != null && !places.findCatalogIdsInMyPlace(userId, ids).isEmpty();
    Map<UUID, Integer> fans = userId != null && dating.canSeeDeck(userId) ? dating.fansOf(userId, ids) : null;
    return toItem(c, saved, fans == null ? null : fans.getOrDefault(c.getId(), 0));
  }

  // ---- Ảnh nền banner Khám phá quán (admin đổi được) ----

  static final String BANNER_KEY = "explore.banner";

  /** Công khai: ảnh nền banner (URL công khai), null = dùng ảnh mặc định */
  @Transactional(readOnly = true)
  public BannerSetting banner() {
    List<String> v =
        jdbc.queryForList("SELECT value FROM app_settings WHERE key = :key", Map.of("key", BANNER_KEY), String.class);
    return new BannerSetting(v.isEmpty() ? null : imageUrls.toPublic(v.getFirst()));
  }

  /** Admin: đổi ảnh nền; null / rỗng = quay về ảnh mặc định */
  public BannerSetting setBanner(String imageUrl) {
    if (imageUrl == null || imageUrl.isBlank()) {
      jdbc.update("DELETE FROM app_settings WHERE key = :key", Map.of("key", BANNER_KEY));
    } else {
      jdbc.update(
          """
          INSERT INTO app_settings (key, value, updated_at) VALUES (:key, :value, now())
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
          """,
          Map.of("key", BANNER_KEY, "value", imageUrls.toStored(imageUrl.strip())));
    }
    return banner();
  }

  // ---- Điểm hẹn nổi bật (admin chọn, tối đa 6) ----

  static final int MAX_FEATURED = 10;

  private record FeaturedRow(int position, UUID catalogId, String kicker, String headline) {}

  /** Công khai: các điểm hẹn nổi bật theo vị trí, kèm "đã lưu" / "người hợp gu" như danh sách quán. */
  @Transactional(readOnly = true)
  public List<FeaturedItem> featured(UUID userId) {
    List<FeaturedRow> rows =
        jdbc.query(
            "SELECT position, catalog_id, kicker, headline FROM featured_places ORDER BY position",
            Map.of(),
            (rs, i) ->
                new FeaturedRow(
                    rs.getInt("position"), rs.getObject("catalog_id", UUID.class), rs.getString("kicker"), rs.getString("headline")));
    if (rows.isEmpty()) return List.of();
    List<UUID> ids = rows.stream().map(FeaturedRow::catalogId).toList();
    Map<UUID, CatalogPlace> byId = new HashMap<>();
    catalog.findAllById(ids).forEach(c -> byId.put(c.getId(), c));
    Set<UUID> saved = userId == null ? Set.of() : new HashSet<>(places.findCatalogIdsInMyPlace(userId, ids));
    Map<UUID, Integer> fans = userId != null && dating.canSeeDeck(userId) ? dating.fansOf(userId, ids) : null;
    return rows.stream()
        .filter(r -> byId.containsKey(r.catalogId()))
        .map(
            r ->
                new FeaturedItem(
                    r.position(),
                    r.kicker(),
                    r.headline(),
                    toItem(byId.get(r.catalogId()), saved.contains(r.catalogId()), fans == null ? null : fans.getOrDefault(r.catalogId(), 0))))
        .toList();
  }

  /** Admin: thay toàn bộ danh sách nổi bật (thứ tự trong danh sách là vị trí; rỗng = tắt khối nổi bật). */
  public List<FeaturedItem> setFeatured(List<FeaturedRequest> list) {
    if (list.size() > MAX_FEATURED) {
      throw new ApiException(ErrorCode.VALIDATION_FAILED, "Tối đa " + MAX_FEATURED + " điểm hẹn nổi bật.");
    }
    if (list.stream().map(FeaturedRequest::catalogId).distinct().count() != list.size()) {
      throw new ApiException(ErrorCode.VALIDATION_FAILED, "Mỗi quán chỉ chọn một lần.");
    }
    for (FeaturedRequest f : list) {
      if (!catalog.existsById(f.catalogId())) throw ApiException.notFound();
    }
    jdbc.update("DELETE FROM featured_places", Map.of());
    for (int i = 0; i < list.size(); i++) {
      FeaturedRequest f = list.get(i);
      jdbc.update(
          "INSERT INTO featured_places (position, catalog_id, kicker, headline) VALUES (:pos, :id, :kicker, :headline)",
          Map.of(
              "pos", i + 1,
              "id", f.catalogId(),
              "kicker", f.kicker() == null ? "" : f.kicker().strip(),
              "headline", f.headline() == null ? "" : f.headline().strip()));
    }
    return featured(null);
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
  public Map<String, Long> counts(CatalogFilter f) {
    Map<String, Long> out = new LinkedHashMap<>();
    out.put("all", catalog.count(filter(f.withType(null))));
    for (PlaceType t : PlaceType.values()) out.put(t.name(), catalog.count(filter(f.withType(t))));
    return out;
  }

  /**
   * {@code userId}: người đang xem, để đánh dấu quán đã có trong My place của họ. {@code mine}: chỉ quán đã
   * có trong My place (hộp chọn điểm của Plan).
   */
  @Transactional(readOnly = true)
  public CatalogPage search(UUID userId, CatalogFilter f, String sort, boolean mine, int page, int size) {
    int pageSize = Math.clamp(size, 1, MAX_PAGE_SIZE);
    Specification<CatalogPlace> spec = filter(f);
    if (mine && userId != null) {
      spec =
          spec.and(
              (root, query, cb) -> {
                var sub = query.subquery(UUID.class);
                var p = sub.from(Place.class);
                sub.select(p.get("catalogId")).where(cb.equal(p.get("user").get("id"), userId));
                return root.get("id").in(sub);
              });
    }
    Sort order =
        switch (sort == null ? "" : sort) {
          case "rating" -> Sort.by(Sort.Direction.DESC, "rating").and(Sort.by("name")).and(Sort.by("id"));
          case "newest" -> Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by("id"));
          // Giá thấp trước: theo giá thấp nhất (biểu thức, không đặt được qua Sort) nên tự orderBy
          case "price" -> {
            spec =
                spec.and(
                    (root, query, cb) -> {
                      if (query.getResultType() != Long.class && query.getResultType() != long.class) {
                        query.orderBy(cb.asc(minPrice(root, cb)), cb.asc(root.get("name")), cb.asc(root.get("id")));
                      }
                      return cb.conjunction();
                    });
            yield Sort.unsorted();
          }
          default -> Sort.by("name").and(Sort.by("id"));
        };
    Page<CatalogPlace> result = catalog.findAll(spec, PageRequest.of(Math.max(page, 0), pageSize, order));
    List<UUID> ids = result.getContent().stream().map(CatalogPlace::getId).toList();
    Set<UUID> saved = ids.isEmpty() || userId == null ? Set.of() : new HashSet<>(places.findCatalogIdsInMyPlace(userId, ids));
    // "Người hợp gu đã lưu": chỉ khi người xem đã đăng nhập và đang bật Tìm đối tượng
    Map<UUID, Integer> fans = userId != null && dating.canSeeDeck(userId) ? dating.fansOf(userId, ids) : null;
    List<CatalogItem> items =
        result.getContent().stream()
            .map(c -> toItem(c, saved.contains(c.getId()), fans == null ? null : fans.getOrDefault(c.getId(), 0)))
            .toList();
    return new CatalogPage(items, result.getTotalElements(), result.getNumber(), pageSize);
  }

  public CatalogItem create(CatalogRequest req) {
    CatalogPlace c = new CatalogPlace();
    apply(req, c);
    applyVibes(req, c, true);
    return toItem(catalog.saveAndFlush(withSlug(c)), false, null);
  }

  public CatalogItem update(UUID id, CatalogRequest req) {
    CatalogPlace c = load(id);
    if (!Objects.equals(c.getVersion(), req.version())) {
      throw new ApiException(ErrorCode.VERSION_CONFLICT).with("current", toItem(c, false, null));
    }
    apply(req, c);
    applyVibes(req, c, false);
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
    if (r.priceTo() != null && (r.priceFrom() == null || r.priceTo() < r.priceFrom())) {
      throw new ApiException(ErrorCode.VALIDATION_FAILED, "Giá đến phải từ giá bắt đầu trở lên.");
    }
    c.setPriceFrom(r.priceFrom());
    c.setPriceTo(r.priceFrom() == null ? null : r.priceTo());
    c.setRating(r.rating());
    c.setOpenTime(r.openTime());
    c.setCloseTime(r.closeTime());
    // Client gửi lại URL công khai (có thể là CDN) → lưu dạng /uploads/<key>
    List<String> photos = VenuePhotos.toStored(r.photos(), r.imageUrl(), imageUrls);
    c.getPhotos().clear();
    c.getPhotos().addAll(photos);
    c.setImageUrl(photos.isEmpty() ? "" : photos.getFirst());
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

  private static void applyVibes(CatalogRequest r, CatalogPlace c, boolean isNew) {
    Tagged t =
        VibeDefaults.resolve(
            r.vibes(),
            Boolean.TRUE.equals(r.vibesAuto()),
            isNew ? null : new Tagged(c.getVibes(), c.getVibesSource()),
            VibeDefaults.forPlace(c.getType(), c.getPriceRange()));
    c.setVibes(t.vibes());
    c.setVibesSource(t.source());
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
        c.getCuisine(),
        c.getPriceFrom(),
        c.getPriceTo());
  }

  /** Giá thấp nhất mỗi người: giá cụ thể, chưa có thì mức thấp nhất của nhóm giá */
  private static Expression<Integer> minPrice(Root<CatalogPlace> root, CriteriaBuilder cb) {
    Expression<Integer> byRange =
        cb.<PriceRange, Integer>selectCase(root.get("priceRange"))
            .when(PriceRange.cheap, 0)
            .when(PriceRange.medium, 50_000)
            .when(PriceRange.high, 150_000)
            .otherwise(400_000);
    return cb.coalesce(root.<Integer>get("priceFrom"), byRange);
  }

  private static Specification<CatalogPlace> filter(CatalogFilter f) {
    Specification<CatalogPlace> spec = (root, query, cb) -> cb.conjunction();
    String q = f.q();
    if (f.type() != null) spec = spec.and((root, query, cb) -> cb.equal(root.get("type"), f.type()));
    if (f.district() != null) spec = spec.and((root, query, cb) -> cb.equal(root.get("district"), f.district()));
    // Lọc theo tiền: chỉ quán đã nhập giá cụ thể; khoảng giá của quán [from, to ?? from] giao với [min, max]
    if (f.priceMin() != null) {
      spec = spec.and((root, query, cb) -> cb.ge(cb.coalesce(root.<Integer>get("priceTo"), root.<Integer>get("priceFrom")), f.priceMin()));
    }
    if (f.priceMax() != null) spec = spec.and((root, query, cb) -> cb.le(root.<Integer>get("priceFrom"), f.priceMax()));
    if (f.minStars() != null) spec = spec.and((root, query, cb) -> cb.ge(root.get("rating"), f.minStars()));
    // Chỉ quán ăn có loại món, nên chọn loại món là chỉ còn quán ăn
    if (!f.cuisines().isEmpty()) spec = spec.and((root, query, cb) -> root.get("cuisine").in(f.cuisines()));
    if (!f.vibes().isEmpty()) {
      spec =
          spec.and(
              (root, query, cb) ->
                  cb.or(f.vibes().stream().map(v -> cb.like(root.get("vibesText"), "%" + v.name() + "%")).toArray(Predicate[]::new)));
    }
    if (f.openAt() != null) {
      spec = spec.and((root, query, cb) -> OpenHours.isOpenAt(cb, root.get("openTime"), root.get("closeTime"), f.openAt(), false));
    }
    if (f.wifi()) spec = spec.and((root, query, cb) -> cb.isTrue(root.get("hasWifi")));
    if (f.parking()) spec = spec.and((root, query, cb) -> cb.isTrue(root.get("hasParking")));
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
        c.getSlug(),
        c.getType(),
        c.getDistrict().name(),
        c.getDistrict().label(),
        c.getName(),
        c.getAddress(),
        c.getPriceRange(),
        c.getPriceFrom(),
        c.getPriceTo(),
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
        VenuePhotos.toPublic(c.getPhotos(), c.getImageUrl(), imageUrls),
        List.copyOf(c.getVibes()),
        c.getVibesSource().code(),
        c.getVersion(),
        c.getCreatedAt(),
        c.getUpdatedAt(),
        inMyPlace,
        fans,
        c.getRatingAvg(),
        c.getRatingCount());
  }
}
