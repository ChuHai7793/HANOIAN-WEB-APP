package com.gfmaster.importer;

import com.gfmaster.common.error.ApiException;
import com.gfmaster.girlfriend.GirlfriendService;
import com.gfmaster.girlfriend.RelationshipStatus;
import com.gfmaster.girlfriend.dto.GirlfriendRequest;
import com.gfmaster.importer.dto.LegacyExport;
import com.gfmaster.place.PlaceService;
import com.gfmaster.place.PlaceType;
import com.gfmaster.place.PriceRange;
import com.gfmaster.place.dto.PlaceRequest;
import com.gfmaster.placelink.PlaceLinkService;
import com.gfmaster.placelink.dto.PlaceLinkRequest;
import com.gfmaster.upload.UploadService;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.math.BigDecimal;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Chuyển dữ liệu localStorage cũ thành bản ghi của user. Chạy bên trong transaction của
 * ImportService: lỗi hạ tầng (DB, storage) thì cả lần import rollback.
 *
 * <p>Dữ liệu cũ không qua kiểm tra nào, nên dòng không hợp lệ (thiếu tên, sai enum, link trỏ tới
 * quán không có...) bị <b>bỏ qua</b> và ghi vào {@code skipped}, thay vì làm hỏng cả lần import. Mỗi
 * dòng đi qua đúng Bean Validation và service như khi tạo qua API.
 */
@Component
public class LegacyImporter {

  /** Tối đa bao nhiêu lý do bỏ qua được ghi lại (đủ để người dùng hiểu, không làm phình stats). */
  static final int MAX_REASONS = 20;
  private static final Pattern DATA_URL = Pattern.compile("^data:image/[a-z+]+;base64,(.+)$", Pattern.DOTALL);

  private final PlaceService places;
  private final GirlfriendService girlfriends;
  private final PlaceLinkService links;
  private final UploadService uploads;
  private final Validator validator;

  public LegacyImporter(
      PlaceService places,
      GirlfriendService girlfriends,
      PlaceLinkService links,
      UploadService uploads,
      Validator validator) {
    this.places = places;
    this.girlfriends = girlfriends;
    this.links = links;
    this.uploads = uploads;
    this.validator = validator;
  }

  /** Kết quả, lưu thành JSON trong {@code import_jobs.stats}. */
  public record Stats(int places, int girlfriends, int placeLinks, int images, int skipped, List<String> skippedReasons) {}

  private final class Run {
    final UUID userId;
    final Map<String, UUID> placeIds = new HashMap<>();
    final Map<String, UUID> girlfriendIds = new HashMap<>();
    final Set<String> linkPairs = new HashSet<>();
    int images;
    int skipped;
    final List<String> reasons = new ArrayList<>();

    Run(UUID userId) {
      this.userId = userId;
    }

    void skip(String what, String why) {
      skipped++;
      if (reasons.size() < MAX_REASONS) reasons.add(what + ": " + why);
    }
  }

  public Stats importAll(UUID userId, LegacyExport export) {
    Run run = new Run(userId);
    export.placesOrEmpty().forEach(p -> importPlace(run, p));
    export.girlfriendsOrEmpty().forEach(g -> importGirlfriend(run, g));
    export.placeLinksOrEmpty().forEach(l -> importLink(run, l));
    return new Stats(
        run.placeIds.size(), run.girlfriendIds.size(), run.linkPairs.size(), run.images, run.skipped, run.reasons);
  }

  private void importPlace(Run run, LegacyExport.Place p) {
    String label = "Quán \"" + orEmpty(p.name()) + "\"";
    try {
      Function<String, PlaceRequest> build =
          imageUrl ->
          new PlaceRequest(
              PlaceType.valueOf(p.type()),
              trim(p.name()),
              orEmpty(p.address()),
              PriceRange.valueOf(p.priceRange()),
              p.rating() == null ? 0 : p.rating(),
              LocalTime.parse(p.openTime()),
              LocalTime.parse(p.closeTime()),
              imageUrl,
              orEmpty(p.note()),
              orEmpty(p.googleMapsUrl()),
              p.lat() == null ? null : BigDecimal.valueOf(p.lat()),
              p.lng() == null ? null : BigDecimal.valueOf(p.lng()),
              p.hasWifi(),
              p.hasParking(),
              p.cuisine());
      // Kiểm tra trước với ảnh trống: dòng bị bỏ qua thì không upload ảnh thừa
      String invalid = violations(build.apply(""));
      if (invalid != null) {
        run.skip(label, invalid);
        return;
      }
      UUID id = places.create(run.userId, build.apply(image(run, p.imageUrl()))).id();
      if (p.id() != null) run.placeIds.put(p.id(), id);
    } catch (IllegalArgumentException | NullPointerException | DateTimeException e) {
      run.skip(label, "dữ liệu không đúng định dạng");
    }
  }

  private void importGirlfriend(Run run, LegacyExport.Girlfriend g) {
    String label = "Người \"" + orEmpty(g.name()) + "\"";
    try {
      Function<String, GirlfriendRequest> build =
          avatarUrl ->
          new GirlfriendRequest(
              trim(g.name()),
              orEmpty(g.nickname()),
              avatarUrl,
              date(g.birthday()),
              orEmpty(g.phone()),
              g.status() == null || g.status().isBlank() ? null : RelationshipStatus.valueOf(g.status()),
              date(g.startedDate()),
              g.hobbies() == null ? List.of() : g.hobbies().stream().map(String::trim).filter(h -> !h.isEmpty()).toList(),
              orEmpty(g.note()));
      String invalid = violations(build.apply(""));
      if (invalid != null) {
        run.skip(label, invalid);
        return;
      }
      UUID id = girlfriends.create(run.userId, build.apply(image(run, g.avatarUrl()))).id();
      if (g.id() != null) run.girlfriendIds.put(g.id(), id);
    } catch (IllegalArgumentException | DateTimeException e) {
      run.skip(label, "dữ liệu không đúng định dạng");
    }
  }

  private void importLink(Run run, LegacyExport.PlaceLink l) {
    String label = "Liên kết " + orEmpty(l.id());
    UUID gf = run.girlfriendIds.get(l.girlfriendId());
    UUID place = run.placeIds.get(l.placeId());
    if (gf == null || place == null) {
      run.skip(label, "người hoặc quán không có trong dữ liệu (hoặc đã bị bỏ qua)");
      return;
    }
    // Trùng cặp thì bỏ qua ngay: để DB báo unique violation sẽ làm hỏng cả transaction
    if (!run.linkPairs.add(gf + ":" + place)) {
      run.skip(label, "trùng với một liên kết khác");
      return;
    }
    try {
      PlaceLinkRequest request =
          new PlaceLinkRequest(
              gf, place, l.herRating() == null ? 0 : l.herRating(), date(l.lastVisitedAt()), orEmpty(l.memory()));
      String invalid = violations(request);
      if (invalid != null) {
        run.linkPairs.remove(gf + ":" + place);
        run.skip(label, invalid);
        return;
      }
      links.create(run.userId, request);
    } catch (DateTimeException e) {
      run.linkPairs.remove(gf + ":" + place);
      run.skip(label, "ngày không đúng định dạng");
    }
  }

  /**
   * Ảnh cũ thường là data URL (base64, frontend cũ nhét thẳng vào localStorage): decode, xử lý như
   * upload thường (resize, WebP) rồi dùng URL mới. Link http(s) giữ nguyên. Ảnh hỏng thì bỏ ảnh,
   * vẫn giữ bản ghi.
   */
  private String image(Run run, String value) {
    if (value == null || value.isBlank()) return "";
    Matcher m = DATA_URL.matcher(value.trim());
    if (!m.matches()) return value.trim().matches(PlaceRequest.IMAGE_URL) ? value.trim() : "";
    try {
      byte[] raw = Base64.getMimeDecoder().decode(m.group(1));
      String url = uploads.storeImage(run.userId, raw).url();
      run.images++;
      return url;
    } catch (IllegalArgumentException | ApiException e) {
      return "";
    }
  }

  /** null nếu hợp lệ, không thì "field: lỗi; field: lỗi". */
  private <T> String violations(T request) {
    Set<ConstraintViolation<T>> errors = validator.validate(request);
    if (errors.isEmpty()) return null;
    return errors.stream()
        .map(v -> v.getPropertyPath() + " " + v.getMessage())
        .sorted()
        .collect(Collectors.joining("; "));
  }

  private static LocalDate date(String value) {
    return value == null || value.isBlank() ? null : LocalDate.parse(value.trim());
  }

  private static String orEmpty(String value) {
    return value == null ? "" : value;
  }

  private static String trim(String value) {
    return value == null ? null : value.trim();
  }
}
