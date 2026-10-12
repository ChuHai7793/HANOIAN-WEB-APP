package com.gfmaster.plan;

import com.gfmaster.catalog.CatalogDistrict;
import com.gfmaster.place.PlaceType;
import com.gfmaster.plan.PlanDtos.Slot;
import com.gfmaster.vibe.Vibe;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;

/**
 * Autoplan theo quy tắc (không gọi AI): chọn khung lịch trình theo buổi và kiểu hẹn, rồi ở mỗi bước chấm
 * điểm các địa điểm cùng loại và lấy ngẫu nhiên trong 3 điểm cao nhất (để "Tạo lại" / "Đổi" ra phương án
 * khác). Chấm điểm chứ không lọc cứng theo kiểu hẹn, nên khu vực ít dữ liệu vẫn ra plan.
 */
public final class Autoplanner {

  private Autoplanner() {}

  public record Options(CatalogDistrict district, Slot slot, Vibe vibe, Integer budget, boolean rainy) {}

  public record Result(LocalTime start, List<Venue> venues, List<String> notes) {}

  /** Loại điểm của một bước trong khung lịch trình. */
  public enum Step {
    SPOT("chỗ chơi"),
    RESTAURANT("quán ăn"),
    CAFE("quán cafe"),
    BAR("quán bar"),
    CAFE_OR_BAR("quán cafe / bar");

    final String label;

    Step(String label) {
      this.label = label;
    }

    boolean matches(Venue v) {
      return switch (this) {
        case SPOT -> v.spotCategory() != null;
        case RESTAURANT -> v.placeType() == PlaceType.restaurant;
        case CAFE -> v.placeType() == PlaceType.cafe;
        case BAR -> v.placeType() == PlaceType.bar;
        case CAFE_OR_BAR -> v.placeType() == PlaceType.cafe || v.placeType() == PlaceType.bar;
      };
    }

    /** Bước tương ứng với một điểm đang có (dùng khi bấm "Đổi"): cùng loại quán, hoặc chỗ chơi bất kỳ. */
    static Step of(Venue v) {
      if (v.spotCategory() != null) return SPOT;
      return switch (v.placeType()) {
        case cafe -> CAFE;
        case bar -> BAR;
        case restaurant -> RESTAURANT;
      };
    }
  }

  public static LocalTime startOf(Slot slot) {
    return switch (slot) {
      case afternoon -> LocalTime.of(14, 0);
      case evening -> LocalTime.of(18, 0);
      case day -> LocalTime.of(9, 0);
    };
  }

  /** Khung lịch trình theo buổi và kiểu hẹn */
  static List<Step> template(Slot slot, Vibe vibe) {
    Step lastEvening = vibe == Vibe.romantic ? Step.BAR : Step.CAFE_OR_BAR;
    return switch (slot) {
      case evening ->
          vibe == Vibe.chill
              ? List.of(Step.RESTAURANT, Step.CAFE, Step.SPOT)
              : vibe == Vibe.active
                  ? List.of(Step.SPOT, Step.RESTAURANT, Step.SPOT)
                  : List.of(Step.SPOT, Step.RESTAURANT, lastEvening);
      case afternoon ->
          vibe == Vibe.active ? List.of(Step.SPOT, Step.CAFE, Step.RESTAURANT) : List.of(Step.CAFE, Step.SPOT, Step.RESTAURANT);
      // Cả ngày kết thúc chiều muộn: cafe chứ không phải bar (bar thường mở từ tối)
      case day -> List.of(Step.CAFE, Step.SPOT, Step.RESTAURANT, Step.SPOT, Step.CAFE);
    };
  }

  public static Result plan(Options o, List<Venue> all, Random rnd) {
    LocalTime clock = startOf(o.slot());
    List<Venue> picked = new ArrayList<>();
    List<String> notes = new ArrayList<>();
    Set<UUID> used = new HashSet<>();
    for (Step step : template(o.slot(), o.vibe())) {
      Venue prev = picked.isEmpty() ? null : picked.getLast();
      // Chưa biết chọn chỗ nào nên giờ tới chỉ ước lượng; giờ chính xác tính lại khi xem plan (Itinerary)
      LocalTime arrival = prev == null ? clock : clock.plusMinutes(Itinerary.UNKNOWN_TRAVEL_MIN);
      Optional<Venue> v = choose(step, prev, arrival, o, all, used, rnd, notes);
      if (v.isEmpty()) continue;
      Venue chosen = v.get();
      picked.add(chosen);
      used.add(chosen.id());
      LocalTime arrive = prev == null ? clock : clock.plusMinutes(Itinerary.leg(prev, chosen).minutes());
      clock = arrive.plusMinutes(chosen.defaultDuration());
    }
    return new Result(startOf(o.slot()), picked, notes.stream().distinct().toList());
  }

  /** Phương án khác cho một điểm: cùng loại, chưa có trong plan, khác điểm hiện tại. */
  public static Optional<Venue> alternative(Venue current, Venue prev, LocalTime arrival, Options o, List<Venue> all, Set<UUID> inPlan, Random rnd) {
    Set<UUID> exclude = new HashSet<>(inPlan);
    exclude.add(current.id());
    return choose(Step.of(current), prev, arrival, o, all, exclude, rnd, new ArrayList<>());
  }

  private static Optional<Venue> choose(
      Step step, Venue prev, LocalTime arrival, Options o, List<Venue> all, Set<UUID> exclude, Random rnd, List<String> notes) {
    List<Venue> pool = all.stream().filter(step::matches).filter(v -> !exclude.contains(v.id())).toList();
    if (pool.isEmpty()) {
      notes.add("Danh mục chưa có " + step.label + " nào khác để đưa vào plan.");
      return Optional.empty();
    }
    // Hợp = mở suốt lúc ở đó, và (trời mưa) ở trong nhà. Thứ tự ưu tiên: hợp trong khu vực > hợp ở quận khác >
    // không hợp trong khu vực (lịch trình sẽ hiện cảnh báo đóng cửa / ngoài trời)
    Predicate<Venue> fits =
        v -> v.openAt(arrival) && v.openAt(arrival.plusMinutes(v.defaultDuration() - 1)) && (!o.rainy() || v.indoor());
    List<Venue> local = pool.stream().filter(v -> v.district() == o.district()).toList();
    List<Venue> candidates = local.stream().filter(fits).toList();
    if (candidates.isEmpty()) {
      List<Venue> fitElsewhere = pool.stream().filter(fits).toList();
      if (!fitElsewhere.isEmpty()) {
        candidates = fitElsewhere;
        notes.add(
            local.isEmpty()
                ? o.district().label() + " chưa có " + step.label + ", đã chọn ở quận khác."
                : o.district().label() + " không có " + step.label + " mở cửa lúc " + arrival + (o.rainy() ? " (trong nhà)" : "")
                    + ", đã chọn ở quận khác.");
      } else {
        candidates = local.isEmpty() ? pool : local;
        if (local.isEmpty()) notes.add(o.district().label() + " chưa có " + step.label + ", đã chọn ở quận khác.");
      }
    }

    List<Venue> ranked =
        candidates.stream().sorted(Comparator.comparingDouble((Venue v) -> score(v, prev, o)).reversed()).limit(3).toList();
    return Optional.of(weighted(ranked, rnd));
  }

  static double score(Venue v, Venue prev, Options o) {
    double s = 0;
    if (o.vibe() != null) s += v.vibeScore(o.vibe());
    s += v.rating() != null ? (v.rating() - 3) * 0.8 : 0.5;
    if (o.budget() != null && v.estimatedPrice() > o.budget()) s -= 4;
    if (prev != null) {
      if (prev.hasCoordinates() && v.hasCoordinates()) {
        s -= Math.min(6, Itinerary.distanceM(prev.lat(), prev.lng(), v.lat(), v.lng()) / 1000 * 1.5);
      } else {
        s -= 1;
      }
    }
    if (v.district() == o.district()) s += 1.5;
    return s;
  }

  /** Lấy ngẫu nhiên có trọng số 3 : 2 : 1 trong danh sách đã xếp hạng. */
  private static Venue weighted(List<Venue> ranked, Random rnd) {
    int[] weights = {3, 2, 1};
    int total = 0;
    for (int i = 0; i < ranked.size(); i++) total += weights[i];
    int r = rnd.nextInt(total);
    for (int i = 0; i < ranked.size(); i++) {
      r -= weights[i];
      if (r < 0) return ranked.get(i);
    }
    return ranked.getFirst();
  }
}
