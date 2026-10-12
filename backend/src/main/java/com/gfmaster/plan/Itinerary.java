package com.gfmaster.plan;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Tính lịch trình: giờ tới / rời từng điểm, quãng đường và thời gian di chuyển, cảnh báo. Quãng đường là
 * đường chim bay giữa hai toạ độ (ước lượng); thiếu toạ độ thì coi như 10 phút di chuyển.
 */
public final class Itinerary {

  /** Dưới ngưỡng này đi bộ (~4,5 km/h), trên thì xe máy (~18 km/h + 5 phút gửi xe). */
  static final int WALK_MAX_M = 1200;
  static final int FAR_M = 3000;
  static final int UNKNOWN_TRAVEL_MIN = 10;

  private Itinerary() {}

  public record Leg(Integer distanceM, int minutes, String mode) {}

  public record Timed(Venue venue, int durationMin, LocalTime arrival, LocalTime departure, Leg fromPrev, List<String> warnings) {}

  public static List<Timed> compute(LocalTime start, List<Venue> venues, List<Integer> durations, boolean rainy) {
    List<Timed> out = new ArrayList<>();
    LocalTime clock = start;
    Venue prev = null;
    for (int i = 0; i < venues.size(); i++) {
      Venue v = venues.get(i);
      Leg leg = prev == null ? null : leg(prev, v);
      LocalTime arrival = leg == null ? clock : clock.plusMinutes(leg.minutes());
      LocalTime departure = arrival.plusMinutes(durations.get(i));
      List<String> warnings = new ArrayList<>();
      if (!v.openAt(arrival)) warnings.add("CLOSED");
      else if (!v.openAt(departure.minusMinutes(1))) warnings.add("CLOSES_EARLY");
      if (leg != null && leg.distanceM() != null && leg.distanceM() > FAR_M) warnings.add("FAR");
      if (prev != null && prev.category().equals(v.category())) warnings.add("SAME_TYPE");
      if (v.needsBooking()) warnings.add("NEEDS_BOOKING");
      if (rainy && !v.indoor()) warnings.add("OUTDOOR_RAIN");
      out.add(new Timed(v, durations.get(i), arrival, departure, leg, warnings));
      clock = departure;
      prev = v;
    }
    return out;
  }

  /** Di chuyển từ {@code a} tới {@code b}. */
  public static Leg leg(Venue a, Venue b) {
    if (!a.hasCoordinates() || !b.hasCoordinates()) return new Leg(null, UNKNOWN_TRAVEL_MIN, null);
    int m = (int) Math.round(distanceM(a.lat(), a.lng(), b.lat(), b.lng()));
    if (m <= WALK_MAX_M) return new Leg(m, Math.max(1, (int) Math.ceil(m / 75.0)), "walk");
    return new Leg(m, (int) Math.ceil(m / 300.0) + 5, "ride");
  }

  /** Khoảng cách đường chim bay (haversine), mét. */
  public static double distanceM(double lat1, double lng1, double lat2, double lng2) {
    double r = 6_371_000;
    double dLat = Math.toRadians(lat2 - lat1);
    double dLng = Math.toRadians(lng2 - lng1);
    double h =
        Math.sin(dLat / 2) * Math.sin(dLat / 2)
            + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * r * Math.asin(Math.sqrt(h));
  }
}
