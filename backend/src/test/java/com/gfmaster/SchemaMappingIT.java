package com.gfmaster;

import static org.assertj.core.api.Assertions.assertThat;

import com.gfmaster.girlfriend.Girlfriend;
import com.gfmaster.girlfriend.GirlfriendRepository;
import com.gfmaster.place.Place;
import com.gfmaster.place.PlaceRepository;
import com.gfmaster.place.PlaceType;
import com.gfmaster.place.PriceRange;
import com.gfmaster.placelink.PlaceLink;
import com.gfmaster.placelink.PlaceLinkRepository;
import com.gfmaster.support.IntegrationTest;
import com.gfmaster.user.User;
import com.gfmaster.user.UserRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.support.TransactionTemplate;

/** Entity ghi/đọc đúng với schema Flyway: UUID, enum chữ thường, hobbies có thứ tự, cascade. */
@IntegrationTest
class SchemaMappingIT {

  @Autowired UserRepository users;
  @Autowired PlaceRepository places;
  @Autowired GirlfriendRepository girlfriends;
  @Autowired PlaceLinkRepository links;
  @Autowired TransactionTemplate tx;

  @Test
  void roundTripAndCascadeDelete() {
    User user = new User();
    user.setEmail("schema-" + UUID.randomUUID() + "@test.local");
    user.setPasswordHash("x");
    user.setDisplayName("Schema");
    users.saveAndFlush(user);

    Place place = new Place();
    place.setUser(user);
    place.setType(PlaceType.cafe);
    place.setName("Cộng Cà Phê");
    place.setPriceRange(PriceRange.medium);
    place.setRating(4);
    place.setOpenTime(LocalTime.of(7, 30));
    place.setCloseTime(LocalTime.of(23, 0));
    place.setLat(new BigDecimal("10.779400"));
    place.setLng(new BigDecimal("106.698900"));
    place.setHasWifi(true);
    places.saveAndFlush(place);

    Girlfriend gf = new Girlfriend();
    gf.setUser(user);
    gf.setName("Mai");
    gf.setBirthday(LocalDate.of(1999, 4, 12));
    gf.setHobbies(List.of("Cà phê sáng", "Xem phim", "Chụp ảnh film"));
    girlfriends.saveAndFlush(gf);

    PlaceLink link = new PlaceLink();
    link.setGirlfriend(gf);
    link.setPlace(place);
    link.setHerRating(5);
    links.saveAndFlush(link);

    assertThat(place.getVersion()).isZero();
    assertThat(places.countByType(user.getId()))
        .singleElement()
        .satisfies(tc -> assertThat(tc.getType()).isEqualTo(PlaceType.cafe));

    tx.executeWithoutResult(
        s -> {
          Girlfriend loaded = girlfriends.findByIdAndUserId(gf.getId(), user.getId()).orElseThrow();
          assertThat(loaded.getHobbies()).containsExactly("Cà phê sáng", "Xem phim", "Chụp ảnh film");
        });
    assertThat(links.findAllByGirlfriendIdAndGirlfriendUserId(gf.getId(), user.getId()))
        .singleElement()
        .satisfies(l -> assertThat(l.getPlace().getName()).isEqualTo("Cộng Cà Phê"));

    // Xoá place → DB tự xoá link (ON DELETE CASCADE)
    tx.executeWithoutResult(s -> places.deleteByIdAndUserId(place.getId(), user.getId()));
    assertThat(links.findById(link.getId())).isEmpty();

    // Không thấy dữ liệu của user khác
    assertThat(girlfriends.findByIdAndUserId(gf.getId(), UUID.randomUUID())).isEmpty();
  }
}
