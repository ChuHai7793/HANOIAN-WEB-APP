package com.gfmaster.spot;

import com.gfmaster.vibe.VibeDefaults;
import com.gfmaster.vibe.VibeDefaults.Tagged;
import com.gfmaster.catalog.CatalogDistrict;
import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.error.ErrorCode;
import com.gfmaster.spot.SpotDtos.SpotItem;
import com.gfmaster.spot.SpotDtos.SpotPage;
import com.gfmaster.spot.SpotDtos.SpotRequest;
import com.gfmaster.upload.storage.ImageUrls;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import java.time.LocalTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** "Tìm chỗ chơi": admin thêm/sửa/xoá; mọi người tìm, lọc theo nhóm, khu vực, giá, trong nhà, giờ mở cửa. */
@Service
@Transactional
public class SpotService {

  static final int MAX_PAGE_SIZE = 100;

  private final DateSpotRepository spots;
  private final ImageUrls imageUrls;

  public SpotService(DateSpotRepository spots, ImageUrls imageUrls) {
    this.spots = spots;
    this.imageUrls = imageUrls;
  }

  /**
   * {@code maxPrice}: giá thấp nhất không quá mức này (0 = chỉ chỗ miễn phí). {@code openAt}: giờ của
   * người xem (client gửi, server không đoán múi giờ); chỗ không có giờ cố định luôn tính là đang mở.
   */
  @Transactional(readOnly = true)
  public SpotPage search(
      String q,
      SpotCategory category,
      CatalogDistrict district,
      Integer maxPrice,
      Boolean indoor,
      LocalTime openAt,
      int page,
      int size) {
    int pageSize = Math.clamp(size, 1, MAX_PAGE_SIZE);
    Page<DateSpot> result =
        spots.findAll(
            filter(q, category, district, maxPrice, indoor, openAt),
            PageRequest.of(Math.max(page, 0), pageSize, Sort.by("name").and(Sort.by("id"))));
    List<SpotItem> items = result.getContent().stream().map(this::toItem).toList();
    return new SpotPage(items, result.getTotalElements(), result.getNumber(), pageSize);
  }

  /** Số chỗ chơi theo từng nhóm cho chip lọc, theo mọi bộ lọc khác đang chọn. Khoá {@code all} là tổng. */
  @Transactional(readOnly = true)
  public Map<String, Long> counts(
      String q, CatalogDistrict district, Integer maxPrice, Boolean indoor, LocalTime openAt) {
    Map<String, Long> out = new LinkedHashMap<>();
    out.put("all", spots.count(filter(q, null, district, maxPrice, indoor, openAt)));
    for (SpotCategory c : SpotCategory.values()) {
      out.put(c.name(), spots.count(filter(q, c, district, maxPrice, indoor, openAt)));
    }
    return out;
  }

  public SpotItem create(SpotRequest req) {
    DateSpot s = new DateSpot();
    apply(req, s);
    applyVibes(req, s, true);
    return toItem(spots.saveAndFlush(s));
  }

  public SpotItem update(UUID id, SpotRequest req) {
    DateSpot s = spots.findById(id).orElseThrow(ApiException::notFound);
    if (!Objects.equals(s.getVersion(), req.version())) {
      throw new ApiException(ErrorCode.VERSION_CONFLICT).with("current", toItem(s));
    }
    apply(req, s);
    applyVibes(req, s, false);
    return toItem(spots.saveAndFlush(s));
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
    s.setImageUrl(r.imageUrl() == null ? "" : imageUrls.toStored(r.imageUrl()));
    s.setGoogleMapsUrl(trimToEmpty(r.googleMapsUrl()));
    s.setLat(r.lat());
    s.setLng(r.lng());
  }

  private static String trimToEmpty(String s) {
    return s == null ? "" : s.trim();
  }

  private static Specification<DateSpot> filter(
      String q, SpotCategory category, CatalogDistrict district, Integer maxPrice, Boolean indoor, LocalTime openAt) {
    Specification<DateSpot> spec = (root, query, cb) -> cb.conjunction();
    if (category != null) spec = spec.and((root, query, cb) -> cb.equal(root.get("category"), category));
    if (district != null) spec = spec.and((root, query, cb) -> cb.equal(root.get("district"), district));
    if (maxPrice != null) spec = spec.and((root, query, cb) -> cb.le(root.get("priceFrom"), maxPrice));
    if (indoor != null) spec = spec.and((root, query, cb) -> cb.equal(root.get("indoor"), indoor));
    if (openAt != null) {
      // So bằng số giây trong ngày: bind thẳng LocalTime vào điều kiện bị quy đổi qua jdbc.time_zone=UTC
      // nên lệch theo múi giờ của JVM (10:00 thành 03:00 ở UTC+7)
      double t = openAt.toSecondOfDay();
      spec =
          spec.and(
              (root, query, cb) -> {
                var open = secondOfDay(cb, root.get("openTime"));
                var close = secondOfDay(cb, root.get("closeTime"));
                Expression<Double> openAtSec = cb.literal(t);
                return cb.or(
                    cb.isNull(root.get("openTime")),
                    // Trong ngày: open ≤ t < close
                    cb.and(
                        cb.lessThanOrEqualTo(open, close),
                        cb.lessThanOrEqualTo(open, openAtSec),
                        cb.greaterThan(close, openAtSec)),
                    // Qua nửa đêm (close < open): t ≥ open hoặc t < close
                    cb.and(
                        cb.greaterThan(open, close),
                        cb.or(cb.lessThanOrEqualTo(open, openAtSec), cb.greaterThan(close, openAtSec))));
              });
    }
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

  /** Postgres date_part('epoch', time): số giây tính từ 00:00 */
  private static Expression<Double> secondOfDay(CriteriaBuilder cb, Expression<LocalTime> time) {
    return cb.function("date_part", Double.class, cb.literal("epoch"), time);
  }

  private SpotItem toItem(DateSpot s) {
    return new SpotItem(
        s.getId(),
        s.getCategory(),
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
        List.copyOf(s.getVibes()),
        s.getVibesSource().code(),
        s.getVersion(),
        s.getCreatedAt(),
        s.getUpdatedAt());
  }
}
