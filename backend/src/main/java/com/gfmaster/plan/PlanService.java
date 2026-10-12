package com.gfmaster.plan;

import com.gfmaster.catalog.CatalogService;
import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.error.ErrorCode;
import com.gfmaster.dating.DatingDtos.MessageView;
import com.gfmaster.dating.DatingService;
import com.gfmaster.plan.Autoplanner.Options;
import com.gfmaster.plan.Itinerary.Timed;
import com.gfmaster.plan.PlanDtos.AddStopRequest;
import com.gfmaster.plan.PlanDtos.AutoplanRequest;
import com.gfmaster.plan.PlanDtos.AutoplanResult;
import com.gfmaster.plan.PlanDtos.PlanRequest;
import com.gfmaster.plan.PlanDtos.PlanStatus;
import com.gfmaster.plan.PlanDtos.PlanSummary;
import com.gfmaster.plan.PlanDtos.PlanView;
import com.gfmaster.plan.PlanDtos.SaveToGirlfriendResult;
import com.gfmaster.plan.PlanDtos.Slot;
import com.gfmaster.plan.PlanDtos.StopKind;
import com.gfmaster.plan.PlanDtos.StopPatch;
import com.gfmaster.plan.PlanDtos.StopView;
import com.gfmaster.plan.PlanRepository.PlanFields;
import com.gfmaster.plan.PlanRepository.PlanRow;
import com.gfmaster.plan.PlanRepository.StopRow;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * "Plan": lịch trình buổi hẹn của từng người. Mỗi người chỉ sửa plan của mình; người được rủ đi (qua tin
 * nhắn) xem được plan đó và chép về làm plan của mình.
 */
@Service
@Transactional
public class PlanService {

  static final int MAX_STOPS = 12;
  private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM");

  private final PlanRepository plans;
  private final DatingService dating;
  private final CatalogService catalog;
  private final Random random;

  @Autowired
  public PlanService(PlanRepository plans, DatingService dating, CatalogService catalog) {
    this(plans, dating, catalog, new Random());
  }

  PlanService(PlanRepository plans, DatingService dating, CatalogService catalog, Random random) {
    this.plans = plans;
    this.dating = dating;
    this.catalog = catalog;
    this.random = random;
  }

  // ---- Plan ----

  @Transactional(readOnly = true)
  public List<PlanSummary> list(UUID me) {
    List<PlanRow> rows = plans.plansOf(me);
    Map<UUID, List<String>> names = plans.stopNames(rows.stream().map(PlanRow::id).toList());
    return rows.stream()
        .map(
            r -> {
              List<String> n = names.getOrDefault(r.id(), List.of());
              return new PlanSummary(
                  r.id(),
                  r.title(),
                  r.date(),
                  r.startTime(),
                  r.district() == null ? null : r.district().label(),
                  r.status(),
                  n.size(),
                  n.stream().limit(5).toList(),
                  firstImage(r.id()),
                  r.updatedAt());
            })
        .toList();
  }

  public PlanView create(UUID me, PlanRequest req) {
    UUID id = plans.insertPlan(me, fields(req, null));
    return view(me, id);
  }

  @Transactional(readOnly = true)
  public PlanView get(UUID me, UUID id) {
    PlanRow row = plans.plan(id).orElseThrow(ApiException::notFound);
    if (!row.userId().equals(me) && !plans.sharedWith(id, me)) throw ApiException.notFound();
    return view(me, row);
  }

  public PlanView update(UUID me, UUID id, PlanRequest req) {
    PlanRow row = own(me, id);
    if (req.version() == null || !plans.updatePlan(id, fields(req, row), req.version())) {
      throw new ApiException(ErrorCode.VERSION_CONFLICT).with("current", view(me, row));
    }
    return view(me, id);
  }

  public PlanView setStatus(UUID me, UUID id, PlanStatus status) {
    own(me, id);
    plans.setStatus(id, status);
    return view(me, id);
  }

  public void delete(UUID me, UUID id) {
    if (!plans.deletePlan(id, me)) throw ApiException.notFound();
  }

  // ---- Điểm dừng ----

  public PlanView addStop(UUID me, UUID id, AddStopRequest req) {
    own(me, id);
    List<StopRow> stops = plans.stops(id);
    if (stops.size() >= MAX_STOPS) throw new ApiException(ErrorCode.PLAN_FULL);
    Venue v = plans.venue(req.kind(), req.refId()).orElseThrow(ApiException::notFound);
    int position = req.position() == null ? stops.size() : Math.min(req.position(), stops.size());
    plans.insertStop(id, position, req.kind(), v.id(), req.durationMin() != null ? req.durationMin() : v.defaultDuration());
    plans.touch(id);
    return view(me, id);
  }

  public PlanView updateStop(UUID me, UUID id, UUID stopId, StopPatch patch) {
    own(me, id);
    StopRow s = stop(id, stopId);
    plans.updateStop(
        stopId,
        patch.durationMin() != null ? patch.durationMin() : s.durationMin(),
        patch.note() != null ? patch.note().strip() : s.note(),
        patch.rating() != null ? patch.rating() : s.rating(),
        patch.memory() != null ? patch.memory().strip() : s.memory());
    plans.touch(id);
    return view(me, id);
  }

  public PlanView deleteStop(UUID me, UUID id, UUID stopId) {
    own(me, id);
    stop(id, stopId);
    plans.deleteStop(id, stopId);
    plans.touch(id);
    return view(me, id);
  }

  public PlanView reorder(UUID me, UUID id, List<UUID> stopIds) {
    own(me, id);
    Set<UUID> current = plans.stops(id).stream().map(StopRow::id).collect(Collectors.toSet());
    if (stopIds.size() != current.size() || !current.equals(new HashSet<>(stopIds))) {
      throw new ApiException(ErrorCode.VALIDATION_FAILED);
    }
    plans.reorder(id, stopIds);
    plans.touch(id);
    return view(me, id);
  }

  /** "Đổi": thay một điểm bằng phương án khác cùng loại, gần điểm trước, hợp kiểu hẹn của plan. */
  public PlanView swapStop(UUID me, UUID id, UUID stopId) {
    PlanRow row = own(me, id);
    List<StopRow> stops = plans.stops(id);
    List<Timed> timed = timed(row, stops);
    int i = indexOf(stops, stopId);
    Venue current = timed.get(i).venue();
    Venue prev = i == 0 ? null : timed.get(i - 1).venue();
    Set<UUID> inPlan = stops.stream().map(StopRow::refId).collect(Collectors.toSet());
    Options o = options(row, current);
    Venue next =
        Autoplanner.alternative(current, prev, timed.get(i).arrival(), o, plans.venues(), inPlan, random)
            .orElseThrow(() -> new ApiException(ErrorCode.NO_ALTERNATIVE));
    plans.replaceStop(stopId, next.kind(), next.id(), next.defaultDuration());
    plans.touch(id);
    return view(me, id);
  }

  // ---- Autoplan ----

  public AutoplanResult autoplan(UUID me, AutoplanRequest req) {
    Slot slot = req.slot() != null ? req.slot() : Slot.evening;
    boolean rainy = Boolean.TRUE.equals(req.rainy());
    Options o = new Options(req.district(), slot, req.vibe(), req.budget(), rainy);
    Autoplanner.Result r = Autoplanner.plan(o, plans.venues(), random);
    if (r.venues().isEmpty()) throw new ApiException(ErrorCode.NO_ALTERNATIVE);

    String title = slotLabel(slot) + " ở " + req.district().label() + (req.date() != null ? " " + req.date().format(DATE) : "");
    UUID id =
        plans.insertPlan(
            me,
            new PlanFields(title, req.date(), r.start(), req.district(), "", PlanStatus.draft, "", req.vibe(), req.budget(), rainy));
    for (int i = 0; i < r.venues().size(); i++) {
      Venue v = r.venues().get(i);
      plans.insertStop(id, i, v.kind(), v.id(), v.defaultDuration());
    }
    return new AutoplanResult(view(me, id), r.notes());
  }

  // ---- Rủ đi / kỷ niệm ----

  /** Gửi plan vào cuộc trò chuyện với một match (tin "Rủ đi" kèm plan). */
  public MessageView share(UUID me, UUID id, UUID matchId) {
    PlanRow row = own(me, id);
    String when = row.date() != null ? " " + row.date().format(DATE) : "";
    return dating.send(me, matchId, "💌 Rủ đi: " + row.title() + when, id);
  }

  /** Người được rủ: chép plan về thành plan nháp của mình. */
  public PlanView copy(UUID me, UUID id) {
    PlanRow row = plans.plan(id).orElseThrow(ApiException::notFound);
    if (!row.userId().equals(me) && !plans.sharedWith(id, me)) throw ApiException.notFound();
    UUID copyId =
        plans.insertPlan(
            me,
            new PlanFields(
                row.title(), row.date(), row.startTime(), row.district(), row.note(), PlanStatus.draft, "", row.vibe(), row.budget(), row.rainy()));
    plans.copyStops(id, copyId);
    return view(me, copyId);
  }

  /**
   * Sau buổi hẹn (chỉ admin, vì Người yêu là dữ liệu của admin): mỗi quán trong plan được thêm vào My place
   * (nếu chưa có) và gắn với người yêu, kèm điểm và kỷ niệm. Chỗ chơi không gắn được (Người yêu chỉ gắn quán).
   */
  public SaveToGirlfriendResult saveToGirlfriend(UUID me, UUID id, UUID girlfriendId) {
    PlanRow row = own(me, id);
    if (!plans.girlfriendOf(girlfriendId, me)) throw ApiException.notFound();
    int linked = 0;
    int skipped = 0;
    LocalDate visited = row.date() != null ? row.date() : LocalDate.now();
    for (StopRow s : plans.stops(id)) {
      if (s.kind() != StopKind.place) {
        skipped++;
        continue;
      }
      UUID placeId = plans.myPlaceFor(me, s.catalogId()).orElseGet(() -> catalog.addToMyPlace(me, s.catalogId()).id());
      String memory = !s.memory().isBlank() ? s.memory() : row.memory();
      plans.upsertLink(girlfriendId, placeId, s.rating() != null ? s.rating() : 4, visited, memory);
      linked++;
    }
    return new SaveToGirlfriendResult(linked, skipped);
  }

  // ---- Helpers ----

  private PlanRow own(UUID me, UUID id) {
    PlanRow row = plans.plan(id).orElseThrow(ApiException::notFound);
    if (!row.userId().equals(me)) throw ApiException.notFound();
    return row;
  }

  private StopRow stop(UUID planId, UUID stopId) {
    return plans.stops(planId).stream().filter(s -> s.id().equals(stopId)).findFirst().orElseThrow(ApiException::notFound);
  }

  private static int indexOf(List<StopRow> stops, UUID stopId) {
    for (int i = 0; i < stops.size(); i++) if (stops.get(i).id().equals(stopId)) return i;
    throw ApiException.notFound();
  }

  private String firstImage(UUID planId) {
    List<StopRow> stops = plans.stops(planId);
    if (stops.isEmpty()) return null;
    Map<UUID, Venue> venues = venuesOf(stops);
    return stops.stream()
        .map(s -> venues.get(s.refId()))
        .filter(Objects::nonNull)
        .map(Venue::imageUrl)
        .filter(u -> u != null && !u.isBlank())
        .findFirst()
        .orElse(null);
  }

  private Map<UUID, Venue> venuesOf(List<StopRow> stops) {
    return plans.venuesByIds(
        stops.stream().map(StopRow::catalogId).filter(Objects::nonNull).toList(),
        stops.stream().map(StopRow::spotId).filter(Objects::nonNull).toList());
  }

  private List<Timed> timed(PlanRow row, List<StopRow> stops) {
    Map<UUID, Venue> venues = venuesOf(stops);
    return Itinerary.compute(
        row.startTime(),
        stops.stream().map(s -> venues.get(s.refId())).toList(),
        stops.stream().map(StopRow::durationMin).toList(),
        row.rainy());
  }

  /** Tuỳ chọn cho "Đổi": theo plan; plan không có khu vực thì lấy khu vực của điểm đang đổi */
  private static Options options(PlanRow row, Venue current) {
    return new Options(
        row.district() != null ? row.district() : current.district(), Slot.evening, row.vibe(), row.budget(), row.rainy());
  }

  private PlanView view(UUID me, UUID id) {
    return view(me, plans.plan(id).orElseThrow(ApiException::notFound));
  }

  private PlanView view(UUID me, PlanRow row) {
    List<StopRow> stops = plans.stops(row.id());
    List<Timed> timed = timed(row, stops);
    List<StopView> views = new ArrayList<>();
    int total = 0;
    for (int i = 0; i < stops.size(); i++) {
      StopRow s = stops.get(i);
      Timed t = timed.get(i);
      Venue v = t.venue();
      Integer dist = t.fromPrev() == null ? null : t.fromPrev().distanceM();
      if (dist != null) total += dist;
      views.add(
          new StopView(
              s.id(),
              i,
              s.kind(),
              s.refId(),
              v.category(),
              v.name(),
              v.address(),
              v.district().name(),
              v.district().label(),
              v.imageUrl(),
              v.lat(),
              v.lng(),
              v.open(),
              v.close(),
              v.indoor(),
              List.copyOf(v.vibes()),
              v.googleMapsUrl(),
              s.durationMin(),
              s.note(),
              s.rating(),
              s.memory(),
              t.arrival(),
              t.departure(),
              dist,
              t.fromPrev() == null ? null : t.fromPrev().minutes(),
              t.fromPrev() == null ? null : t.fromPrev().mode(),
              t.warnings()));
    }
    LocalTime end = timed.isEmpty() ? row.startTime() : timed.getLast().departure();
    return new PlanView(
        row.id(),
        row.title(),
        row.date(),
        row.startTime(),
        end,
        row.district() == null ? null : row.district().name(),
        row.district() == null ? null : row.district().label(),
        row.note(),
        row.status(),
        row.memory(),
        row.vibe(),
        row.budget(),
        row.rainy(),
        row.userId().equals(me),
        row.ownerName(),
        total,
        views,
        row.version(),
        row.createdAt(),
        row.updatedAt());
  }

  private static PlanFields fields(PlanRequest r, PlanRow current) {
    return new PlanFields(
        r.title().strip(),
        r.date(),
        r.startTime(),
        r.district(),
        r.note() == null ? "" : r.note().strip(),
        r.status() != null ? r.status() : current != null ? current.status() : PlanStatus.draft,
        r.memory() != null ? r.memory().strip() : current != null ? current.memory() : "",
        r.vibe(),
        r.budget(),
        Boolean.TRUE.equals(r.rainy()));
  }

  private static String slotLabel(Slot slot) {
    return switch (slot) {
      case afternoon -> "Chiều";
      case evening -> "Tối";
      case day -> "Cả ngày";
    };
  }
}
