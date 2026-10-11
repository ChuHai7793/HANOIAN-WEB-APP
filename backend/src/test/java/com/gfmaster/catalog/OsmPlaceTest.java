package com.gfmaster.catalog;

import static org.assertj.core.api.Assertions.assertThat;

import com.gfmaster.place.PlaceType;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

class OsmPlaceTest {

  private final JsonMapper json = JsonMapper.builder().build();

  private OsmPlace parse(String element) {
    JsonNode node = json.readTree(element);
    return OsmPlace.parse(node);
  }

  @Test
  void nodeWithFullTags() {
    OsmPlace p =
        parse(
            """
            {"type": "node", "id": 123, "lat": 21.0285123, "lon": 105.8542987,
             "tags": {"amenity": "cafe", "name": "Cafe Giảng", "addr:housenumber": "39",
                      "addr:street": "Nguyễn Hữu Huân", "addr:subdistrict": "Lý Thái Tổ",
                      "opening_hours": "Mo-Su 07:00-22:00", "cuisine": "coffee_shop;vietnamese",
                      "contact:phone": "+84 24 3828 9467", "website": "https://cafegiang.vn",
                      "internet_access": "wlan"}}
            """);
    assertThat(p.externalId()).isEqualTo("node/123");
    assertThat(p.name()).isEqualTo("Cafe Giảng");
    assertThat(p.address()).isEqualTo("39 Nguyễn Hữu Huân, Lý Thái Tổ");
    assertThat(p.lat()).isEqualByComparingTo(new BigDecimal("21.028512"));
    assertThat(p.lng()).isEqualByComparingTo(new BigDecimal("105.854299"));
    assertThat(p.openingHours()).isEqualTo("Mo-Su 07:00-22:00");
    assertThat(p.cuisine()).isEqualTo("coffee_shop, vietnamese");
    assertThat(p.phone()).isEqualTo("+84 24 3828 9467");
    assertThat(p.website()).isEqualTo("https://cafegiang.vn");
    assertThat(p.hasWifi()).isTrue();
  }

  @Test
  void wayUsesCenterAndMissingTagsAreNull() {
    OsmPlace p =
        parse(
            """
            {"type": "way", "id": 9, "center": {"lat": 21.03, "lon": 105.85},
             "tags": {"name": "Cộng Cà Phê", "addr:street": "Tràng Tiền", "internet_access": "no"}}
            """);
    assertThat(p.externalId()).isEqualTo("way/9");
    assertThat(p.address()).isEqualTo("Tràng Tiền");
    assertThat(p.lat()).isEqualByComparingTo("21.03");
    assertThat(p.openingHours()).isNull();
    assertThat(p.hasWifi()).isFalse();
  }

  @Test
  void houseNumberWithoutStreetIsNotAnAddress() {
    OsmPlace p =
        parse(
            """
            {"type": "node", "id": 7, "lat": 21, "lon": 105,
             "tags": {"name": "20 Railway", "addr:housenumber": "20"}}
            """);
    assertThat(p.address()).isNull();
  }

  @Test
  void withoutNameOrCoordinatesIsSkipped() {
    assertThat(parse("{\"type\": \"node\", \"id\": 1, \"lat\": 21, \"lon\": 105, \"tags\": {}}")).isNull();
    assertThat(parse("{\"type\": \"way\", \"id\": 2, \"tags\": {\"name\": \"X\"}}")).isNull();
  }

  @Test
  void queryMapsBarToBarOrPubInsideDistrictBox() {
    String q = OverpassClient.query(PlaceType.bar, CatalogDistrict.HOAN_KIEM);
    assertThat(q).contains("\"amenity\"~\"^(bar|pub)$\"").contains("[\"name\"]").contains(CatalogDistrict.HOAN_KIEM.overpassBbox());
  }
}
