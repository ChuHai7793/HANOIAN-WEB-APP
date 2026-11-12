package com.gfmaster.spot;

import com.gfmaster.catalog.CatalogDistrict;
import com.gfmaster.catalog.CatalogDtos.BannerSetting;
import com.gfmaster.catalog.FeaturedSlots;
import com.gfmaster.catalog.FeaturedSlots.Entry;
import com.gfmaster.catalog.FeaturedSlots.Row;
import com.gfmaster.catalog.VenuePhotos;
import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.error.ErrorCode;
import com.gfmaster.common.jpa.OpenHours;
import com.gfmaster.common.jpa.VenueSpecs;
import com.gfmaster.common.settings.AppSettings;
import com.gfmaster.common.web.Slugs;
import com.gfmaster.spot.SpotDtos.FeaturedSpot;
import com.gfmaster.spot.SpotDtos.FeaturedSpotRequest;
import com.gfmaster.spot.SpotDtos.SpotItem;
import com.gfmaster.spot.SpotDtos.SpotPage;
import com.gfmaster.spot.SpotDtos.SpotRequest;
import com.gfmaster.upload.storage.ImageUrls;
import com.gfmaster.vibe.VibeDefaults;
import com.gfmaster.vibe.VibeDefaults.Tagged;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Tuple;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** "Tìm chỗ chơi": admin thêm/sửa/xoá; mọi người tìm, lọc theo nhóm, khu vực, giá, trong nhà, giờ mở cửa. */
@Service
@Transactional
public class SpotService {

  static final int MAX_PAGE_SIZE = 100;
  static final String BANNER_KEY = "spots.banner";
  static final int MAX_FEATURED = FeaturedSlots.MAX;

  private final DateSpotRepository spots;
  private final ImageUrls imageUrls;
  private final NamedParameterJdbcTemplate jdbc;
  private final AppSettings settings;
  private final FeaturedSlots featured;
  private final EntityManager em;

  public SpotService(
      DateSpotRepository spots,
      ImageUrls imageUrls,
      NamedParameterJdbcTemplate jdbc,
      AppSettings settings,
      FeaturedSlots featured,
      EntityManager em) {
    this.spots = spots;
    this.imageUrls = imageUrls;
    this.jdbc = jdbc;
    this.settings = settings;
    this.featured = featured;
    this.em = em;
  }

  /**
   * {@code maxPrice}: giá thấp nhất không quá mức này (0 = chỉ chỗ miễn phí). {@code openAt}: giờ của
   * người xem (client gửi, server không đoán múi giờ); chỗ không có giờ cố định luôn tính là đang mở.
   */
  @Transactional(readOnly = true)
  public SpotPage search(UUID userId, SpotFilter f, String sort, int page, int size) {
    int pageSize = Math.clamp(size, 1, MAX_PAGE_SIZE);
    Sort order =
        switch (sort == null ? "" : sort) {
          case "price" -> Sort.by("priceFrom").and(Sort.by("name")).and(Sort.by("id"));
          case "newest" -> Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by("id"));
          default -> Sort.by("name").and(Sort.by("id"));
        };
    Page<DateSpot> result = spots.findAll(filter(f), PageRequest.of(Math.max(page, 0), pageSize, order));
    Set<UUID> saved = savedAmong(userId, result.getContent().stream().map(DateSpot::getId).toList());
    List<SpotItem> items = result.getContent().stream().map(s -> toItem(s, saved.contains(s.getId()))).toList();
    return new SpotPage(items, result.getTotalElements(), result.getNumber(), pageSize);
  }

  /**
   * Số chỗ chơi theo từng nhóm cho chip lọc, theo mọi bộ lọc khác đang chọn. Khoá {@code all} là tổng. Hai truy vấn
   * GROUP BY: theo nhóm chính (mỗi chỗ đúng một nhóm, cộng lại là tổng) và theo nhóm phụ (không chứa nhóm chính).
   */
  @Transactional(readOnly = true)
  public Map<String, Long> counts(SpotFilter f) {
    Specification<DateSpot> spec = filter(f.withCategory(null));
    CriteriaBuilder cb = em.getCriteriaBuilder();
    Map<SpotCategory, Long> byCategory = new EnumMap<>(SpotCategory.class);

    CriteriaQuery<Tuple> primary = cb.createTupleQuery();
    Root<DateSpot> root = primary.from(DateSpot.class);
    Predicate where = spec.toPredicate(root, primary, cb);
    primary.multiselect(root.get("category"), cb.count(root)).groupBy(root.get("category"));
    if (where != null) primary.where(where);
    for (Tuple t : em.createQuery(primary).getResultList()) byCategory.put(t.get(0, SpotCategory.class), t.get(1, Long.class));
    long all = byCategory.values().stream().mapToLong(Long::longValue).sum();

    CriteriaQuery<Tuple> extra = cb.createTupleQuery();
    Root<DateSpot> root2 = extra.from(DateSpot.class);
    Join<DateSpot, SpotCategory> e = root2.join("extraCategories");
    Predicate where2 = spec.toPredicate(root2, extra, cb);
    extra.multiselect(e, cb.count(root2)).groupBy(e);
    if (where2 != null) extra.where(where2);
    for (Tuple t : em.createQuery(extra).getResultList()) byCategory.merge(t.get(0, SpotCategory.class), t.get(1, Long.class), Long::sum);

    Map<String, Long> out = new LinkedHashMap<>();
    out.put("all", all);
    for (SpotCategory c : SpotCategory.values()) out.put(c.name(), byCategory.getOrDefault(c, 0L));
    return out;
  }

  /** Gán đường dẫn trang riêng cho chỗ chơi mới (giữ nguyên khi đổi tên sau này) */
  DateSpot withSlug(DateSpot s) {
    if (s.getSlug() == null) s.setSlug(Slugs.unique(s.getName(), "cho-choi", spots::existsBySlug));
    return s;
  }

  /** Trang riêng của chỗ chơi: /cho-choi/{slug}. Công khai. */
  @Transactional(readOnly = true)
  public SpotItem bySlug(UUID userId, String slug) {
    DateSpot s = spots.findBySlug(slug).orElseThrow(ApiException::notFound);
    return toItem(s, !savedAmong(userId, List.of(s.getId())).isEmpty());
  }

  public SpotItem create(SpotRequest req) {
    DateSpot s = new DateSpot();
    apply(req, s);
    applyVibes(req, s, true);
    return toItem(spots.saveAndFlush(withSlug(s)), false);
  }

  public SpotItem update(UUID id, SpotRequest req) {
    DateSpot s = spots.findById(id).orElseThrow(ApiException::notFound);
    if (!Objects.equals(s.getVersion(), req.version())) {
      throw new ApiException(ErrorCode.VERSION_CONFLICT).with("current", toItem(s, false));
    }
    apply(req, s);
    applyVibes(req, s, false);
    return toItem(spots.saveAndFlush(s), false);
  }

  // ---- Ảnh nền banner Tìm chỗ chơi (admin đổi được) ----

  /** Công khai: ảnh nền banner (URL công khai), null = frontend tự chọn ảnh mặc định */
  @Transactional(readOnly = true)
  public BannerSetting banner() {
    return new BannerSetting(settings.get(BANNER_KEY).map(imageUrls::toPublic).orElse(null));
  }

  /** Admin: đổi ảnh nền; null / rỗng = quay về ảnh mặc định */
  public BannerSetting setBanner(String imageUrl) {
    settings.set(BANNER_KEY, imageUrl == null ? null : imageUrls.toStored(imageUrl.strip()));
    return banner();
  }

  // ---- Chỗ chơi nổi bật (admin chọn) ----

  /** Công khai: các chỗ chơi nổi bật theo vị trí, kèm "đã lưu" như danh sách. */
  @Transactional(readOnly = true)
  public List<FeaturedSpot> featured(UUID userId) {
    List<Row> rows = featured.list(FeaturedSlots.Table.SPOTS);
    if (rows.isEmpty()) return List.of();
    List<UUID> ids = rows.stream().map(Row::id).toList();
    Map<UUID, DateSpot> byId = new HashMap<>();
    spots.findAllById(ids).forEach(s -> byId.put(s.getId(), s));
    Set<UUID> saved = savedAmong(userId, ids);
    return rows.stream()
        .filter(r -> byId.containsKey(r.id()))
        .map(r -> new FeaturedSpot(r.position(), r.kicker(), r.headline(), toItem(byId.get(r.id()), saved.contains(r.id()))))
        .toList();
  }

  /** Admin: thay toàn bộ danh sách nổi bật (thứ tự trong danh sách là vị trí; rỗng = tắt khối nổi bật). */
  public List<FeaturedSpot> setFeatured(List<FeaturedSpotRequest> list) {
    featured.replace(
        FeaturedSlots.Table.SPOTS,
        list.stream().map(f -> new Entry(f.spotId(), f.kicker(), f.headline())).toList(),
        spots::existsById,
        "chỗ chơi");
    return featured(null);
  }

  // ---- My place: lưu / bỏ chỗ chơi (mỗi người một danh sách) ----

  /** Lưu vào My place; đã lưu rồi thì 409 ALREADY_IN_MY_PLACE. */
  public SpotItem save(UUID userId, UUID id) {
    DateSpot s = spots.findById(id).orElseThrow(ApiException::notFound);
    int inserted =
        jdbc.update(
            "INSERT INTO saved_spots (user_id, spot_id, created_at) VALUES (:user, :spot, now()) ON CONFLICT DO NOTHING",
            Map.of("user", userId, "spot", id));
    if (inserted == 0) throw new ApiException(ErrorCode.ALREADY_IN_MY_PLACE);
    return toItem(s, true);
  }

  public void unsave(UUID userId, UUID id) {
    int removed =
        jdbc.update("DELETE FROM saved_spots WHERE user_id = :user AND spot_id = :spot", Map.of("user", userId, "spot", id));
    if (removed == 0) throw ApiException.notFound();
  }

  /** Chỗ chơi đã lưu, mới lưu trước. */
  @Transactional(readOnly = true)
  public List<SpotItem> saved(UUID userId) {
    List<UUID> ids =
        jdbc.queryForList(
            "SELECT spot_id FROM saved_spots WHERE user_id = :user ORDER BY created_at DESC, spot_id",
            Map.of("user", userId),
            UUID.class);
    Map<UUID, DateSpot> byId = new HashMap<>();
    spots.findAllById(ids).forEach(s -> byId.put(s.getId(), s));
    return ids.stream().map(byId::get).filter(Objects::nonNull).map(s -> toItem(s, true)).toList();
  }

  private Set<UUID> savedAmong(UUID userId, List<UUID> ids) {
    if (userId == null || ids.isEmpty()) return Set.of();
    return new HashSet<>(
        jdbc.queryForList(
            "SELECT spot_id FROM saved_spots WHERE user_id = :user AND spot_id IN (:ids)",
            Map.of("user", userId, "ids", ids),
            UUID.class));
  }

  public void delete(UUID id) {
    if (!spots.existsById(id)) throw ApiException.notFound();
    spots.deleteById(id);
  }

  private static void applyVibes(SpotRequest r, DateSpot s, boolean isNew) {
    Tagged t =
        VibeDefaults.resolve(
            r.vibes(),
            Boolean.TRUE.equals(r.vibesAuto()),
            isNew ? null : new Tagged(s.getVibes(), s.getVibesSource()),
            VibeDefaults.forSpot(s.getCategory()));
    s.setVibes(t.vibes());
    s.setVibesSource(t.source());
  }

  private void apply(SpotRequest r, DateSpot s) {
    if (r.priceTo() != null && r.priceTo() < r.priceFrom()) {
      throw new ApiException(ErrorCode.VALIDATION_FAILED, "Giá đến phải lớn hơn hoặc bằng giá từ.");
    }
    if ((r.openTime() == null) != (r.closeTime() == null)) {
      throw new ApiException(ErrorCode.VALIDATION_FAILED, "Nhập cả giờ mở và giờ đóng, hoặc bỏ trống cả hai.");
    }
    s.setCategory(r.category());
    if (r.extraCategories() != null) {
      s.getExtraCategories().clear();
      r.extraCategories().stream().filter(c -> c != null && c != r.category()).forEach(s.getExtraCategories()::add);
    } else {
      // Đổi nhóm chính sang một nhóm đang là "nhóm khác": bỏ trùng
      s.getExtraCategories().remove(r.category());
    }
    s.setDistrict(r.district());
    s.setName(r.name().trim());
    s.setAddress(trimToEmpty(r.address()));
    s.setDescription(trimToEmpty(r.description()));
    s.setPriceFrom(r.priceFrom());
    // "Từ 100k đến 100k" là một mức giá
    s.setPriceTo(Objects.equals(r.priceTo(), r.priceFrom()) ? null : r.priceTo());
    s.setOpenTime(r.openTime());
    s.setCloseTime(r.closeTime());
    s.setHoursNote(trimToEmpty(r.hoursNote()));
    s.setDurationMin(r.durationMin());
    s.setIndoor(r.indoor());
    s.setNeedsBooking(Boolean.TRUE.equals(r.needsBooking()));
    s.setBookingUrl(trimToEmpty(r.bookingUrl()));
    // Client gửi lại URL công khai (có thể là CDN) → lưu dạng /uploads/<key>
    List<String> photos = VenuePhotos.toStored(r.photos(), r.imageUrl(), imageUrls);
    s.getPhotos().clear();
    s.getPhotos().addAll(photos);
    s.setImageUrl(photos.isEmpty() ? "" : photos.getFirst());
    s.setGoogleMapsUrl(trimToEmpty(r.googleMapsUrl()));
    s.setLat(r.lat());
    s.setLng(r.lng());
  }

  private static String trimToEmpty(String s) {
    return s == null ? "" : s.trim();
  }

  private static Specification<DateSpot> filter(SpotFilter f) {
    SpotCategory category = f.category();
    CatalogDistrict district = f.district();
    Integer maxPrice = f.maxPrice();
    Boolean indoor = f.indoor();
    Specification<DateSpot> spec = (root, query, cb) -> cb.conjunction();
    // Nhóm chính hoặc một trong các nhóm khác
    if (category != null) {
      spec =
          spec.and(
              (root, query, cb) ->
                  cb.or(cb.equal(root.get("category"), category), cb.isMember(category, root.get("extraCategories"))));
    }
    if (district != null) spec = spec.and((root, query, cb) -> cb.equal(root.get("district"), district));
    if (maxPrice != null) spec = spec.and((root, query, cb) -> cb.le(root.get("priceFrom"), maxPrice));
    if (indoor != null) spec = spec.and((root, query, cb) -> cb.equal(root.get("indoor"), indoor));
    if (f.openAt() != null) {
      spec = spec.and((root, query, cb) -> OpenHours.isOpenAt(cb, root.get("openTime"), root.get("closeTime"), f.openAt(), true));
    }
    if (f.minDuration() != null) spec = spec.and((root, query, cb) -> cb.ge(root.get("durationMin"), f.minDuration()));
    if (f.maxDuration() != null) spec = spec.and((root, query, cb) -> cb.le(root.get("durationMin"), f.maxDuration()));
    if (f.noBooking()) spec = spec.and((root, query, cb) -> cb.isFalse(root.get("needsBooking")));
    spec = spec.and(VenueSpecs.anyVibe(f.vibes()));
    return spec.and(VenueSpecs.search(f.q()));
  }

  private SpotItem toItem(DateSpot s, boolean inMyPlace) {
    return new SpotItem(
        s.getId(),
        s.getSlug(),
        s.getCategory(),
        s.getExtraCategories().stream().sorted().toList(),
        s.getDistrict().name(),
        s.getDistrict().label(),
        s.getName(),
        s.getAddress(),
        s.getDescription(),
        s.getPriceFrom(),
        s.getPriceTo(),
        s.getOpenTime(),
        s.getCloseTime(),
        s.getHoursNote(),
        s.getDurationMin(),
        s.isIndoor(),
        s.isNeedsBooking(),
        s.getBookingUrl(),
        imageUrls.toPublic(s.getImageUrl()),
        s.getGoogleMapsUrl(),
        s.getLat(),
        s.getLng(),
        VenuePhotos.toPublic(s.getPhotos(), s.getImageUrl(), imageUrls),
        List.copyOf(s.getVibes()),
        s.getVibesSource().code(),
        s.getVersion(),
        s.getCreatedAt(),
        s.getUpdatedAt(),
        inMyPlace,
        s.getRatingAvg(),
        s.getRatingCount());
  }
}
