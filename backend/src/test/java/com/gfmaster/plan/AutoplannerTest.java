package com.gfmaster.plan;

import static org.assertj.core.api.Assertions.assertThat;

import com.gfmaster.catalog.CatalogDistrict;
import com.gfmaster.place.PlaceType;
import com.gfmaster.place.PriceRange;
import com.gfmaster.plan.Autoplanner.Options;
import com.gfmaster.plan.PlanDtos.Slot;
import com.gfmaster.plan.PlanDtos.StopKind;
import com.gfmaster.spot.SpotCategory;
import com.gfmaster.vibe.Vibe;
import java.time.LocalTime;
import java.util.EnumSet;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AutoplannerTest {

  private static final CatalogDistrict HK = CatalogDistrict.HOAN_KIEM;

  @Test
  void eveningFollowsTemplateAndStaysInDistrict() {
    List<Venue> all =
        List.of(
            spot("Music box", SpotCategory.entertainment, HK, true),
            place("Phở", PlaceType.restaurant, HK, PriceRange.cheap),
            place("Cafe", PlaceType.cafe, HK, PriceRange.medium),
            place("Cafe Tây Hồ", PlaceType.cafe, CatalogDistrict.TAY_HO, PriceRange.medium));
    Autoplanner.Result r = Autoplanner.plan(new Options(HK, Slot.evening, null, null, false), all, new Random(1));

    assertThat(r.start()).isEqualTo(LocalTime.of(18, 0));
    assertThat(r.venues()).extracting(Venue::name).containsExactly("Music box", "Phở", "Cafe");
    assertThat(r.notes()).isEmpty();
  }

  @Test
  void missingKindFallsBackToOtherDistrictWithNote() {
    List<Venue> all =
        List.of(
            spot("Music box", SpotCategory.entertainment, HK, true),
            place("Phở", PlaceType.restaurant, HK, PriceRange.cheap),
            place("Bar Tây Hồ", PlaceType.bar, CatalogDistrict.TAY_HO, PriceRange.high));
    Autoplanner.Result r = Autoplanner.plan(new Options(HK, Slot.evening, Vibe.romantic, null, false), all, new Random(1));

    assertThat(r.venues()).extracting(Venue::name).containsExactly("Music box", "Phở", "Bar Tây Hồ");
    assertThat(r.notes()).singleElement().asString().contains("Hoàn Kiếm").contains("quận khác");
  }

  @Test
  void vibeTagsAndRainAndBudgetSteerTheChoice() {
    Venue museum = spot("Bảo tàng", SpotCategory.museum, HK, true);
    Venue lake = spot("Hồ Gươm", SpotCategory.outdoor, HK, false);
    Venue workshop = withVibes(spot("Làm nến", SpotCategory.workshop, HK, true), EnumSet.of(Vibe.romantic));
    Options romanticRain = new Options(HK, Slot.evening, Vibe.romantic, null, true);
    // Trời mưa: không bao giờ chọn hồ; lãng mạn: workshop gắn nhãn romantic được điểm cao nhất
    for (int seed = 0; seed < 20; seed++) {
      Venue first = Autoplanner.plan(romanticRain, List.of(museum, lake, workshop), new Random(seed)).venues().getFirst();
      assertThat(first.name()).isNotEqualTo("Hồ Gươm");
    }
    assertThat(Autoplanner.score(workshop, null, romanticRain)).isGreaterThan(Autoplanner.score(museum, null, romanticRain));

    Venue cheap = place("Bún chả", PlaceType.restaurant, HK, PriceRange.cheap);
    Venue fancy = place("Nhà hàng sang", PlaceType.restaurant, HK, PriceRange.luxury);
    Options budget = new Options(HK, Slot.evening, null, 150_000, false);
    assertThat(Autoplanner.score(cheap, null, budget)).isGreaterThan(Autoplanner.score(fancy, null, budget));
  }

  @Test
  void prefersPlacesOpenForTheWholeStayEvenInAnotherDistrict() {
    // Workshop trong khu vực đóng 18:30 (ở 120 phút từ 18:00 là quá giờ); workshop ở Tây Hồ mở tới 21:00
    Venue closing = hours(spot("Workshop đóng sớm", SpotCategory.workshop, HK, true), LocalTime.of(9, 0), LocalTime.of(18, 30));
    Venue open = hours(spot("Workshop Tây Hồ", SpotCategory.workshop, CatalogDistrict.TAY_HO, true), LocalTime.of(9, 0), LocalTime.of(21, 0));
    Venue phở = place("Phở", PlaceType.restaurant, HK, PriceRange.cheap);
    Venue cafe = place("Cafe", PlaceType.cafe, HK, PriceRange.cheap);
    Autoplanner.Result r =
        Autoplanner.plan(new Options(HK, Slot.evening, null, null, false), List.of(closing, open, phở, cafe), new Random(1));
    assertThat(r.venues().getFirst().name()).isEqualTo("Workshop Tây Hồ");
    assertThat(r.notes()).singleElement().asString().contains("mở cửa lúc 18:00");
  }

  @Test
  void dayPlanEndsAtACafeNotABar() {
    assertThat(Autoplanner.template(Slot.day, Vibe.romantic).getLast()).isEqualTo(Autoplanner.Step.CAFE);
  }

  @Test
  void alternativeIsSameKindAndNotInPlan() {
    Venue a = place("Cafe A", PlaceType.cafe, HK, PriceRange.medium);
    Venue b = place("Cafe B", PlaceType.cafe, HK, PriceRange.medium);
    Venue bar = place("Bar", PlaceType.bar, HK, PriceRange.medium);
    Options o = new Options(HK, Slot.evening, null, null, false);

    assertThat(Autoplanner.alternative(a, null, LocalTime.of(19, 0), o, List.of(a, b, bar), Set.of(a.id()), new Random(1)))
        .contains(b);
    assertThat(Autoplanner.alternative(a, null, LocalTime.of(19, 0), o, List.of(a, b, bar), Set.of(a.id(), b.id()), new Random(1)))
        .isEmpty();
  }

  @Test
  void itineraryComputesTimesDistanceAndWarnings() {
    Venue cafe = at(place("Cafe", PlaceType.cafe, HK, PriceRange.medium), 21.0285, 105.8542);
    Venue cafe2 = at(place("Cafe 2", PlaceType.cafe, HK, PriceRange.medium), 21.0315, 105.8542); // ~330m
    Venue far = at(place("Quán xa", PlaceType.restaurant, HK, PriceRange.cheap), 21.0700, 105.8542); // ~4,3km
    List<Itinerary.Timed> t =
        Itinerary.compute(LocalTime.of(21, 0), List.of(cafe, cafe2, far), List.of(60, 30, 60), false);

    assertThat(t.get(0).arrival()).isEqualTo(LocalTime.of(21, 0));
    assertThat(t.get(1).fromPrev().mode()).isEqualTo("walk");
    assertThat(t.get(1).fromPrev().distanceM()).isBetween(300, 360);
    assertThat(t.get(1).arrival()).isEqualTo(LocalTime.of(22, 5)); // 21:00 + 60 + 5 phút đi bộ
    assertThat(t.get(1).warnings()).contains("SAME_TYPE", "CLOSED"); // cafe mẫu đóng 22:00
    assertThat(t.get(2).fromPrev().mode()).isEqualTo("ride");
    assertThat(t.get(2).warnings()).contains("FAR");
  }

  // ---- Helpers ----

  private static Venue place(String name, PlaceType type, CatalogDistrict d, PriceRange price) {
    return new Venue(
        StopKind.place, UUID.randomUUID(), type, null, name, "", d, "", null, null, LocalTime.of(7, 0), LocalTime.of(22, 0),
        true, false, EnumSet.noneOf(Vibe.class), "", 4, price, 0, null);
  }

  private static Venue spot(String name, SpotCategory c, CatalogDistrict d, boolean indoor) {
    return new Venue(
        StopKind.spot, UUID.randomUUID(), null, c, name, "", d, "", null, null, null, null, indoor, false,
        EnumSet.noneOf(Vibe.class), "", null, null, 0, 90);
  }

  private static Venue withVibes(Venue v, Set<Vibe> vibes) {
    return new Venue(
        v.kind(), v.id(), v.placeType(), v.spotCategory(), v.name(), v.address(), v.district(), v.imageUrl(), v.lat(), v.lng(),
        v.open(), v.close(), v.indoor(), v.needsBooking(), vibes, v.googleMapsUrl(), v.rating(), v.price(), v.priceFrom(),
        v.spotDurationMin());
  }

  private static Venue hours(Venue v, LocalTime open, LocalTime close) {
    return new Venue(
        v.kind(), v.id(), v.placeType(), v.spotCategory(), v.name(), v.address(), v.district(), v.imageUrl(), v.lat(), v.lng(),
        open, close, v.indoor(), v.needsBooking(), v.vibes(), v.googleMapsUrl(), v.rating(), v.price(), v.priceFrom(),
        120);
  }

  private static Venue at(Venue v, double lat, double lng) {
    return new Venue(
        v.kind(), v.id(), v.placeType(), v.spotCategory(), v.name(), v.address(), v.district(), v.imageUrl(), lat, lng,
        v.open(), v.close(), v.indoor(), v.needsBooking(), v.vibes(), v.googleMapsUrl(), v.rating(), v.price(), v.priceFrom(),
        v.spotDurationMin());
  }
}
