package com.gfmaster.maps;

import static org.assertj.core.api.Assertions.assertThat;

import com.gfmaster.maps.GmapUrlParser.LatLng;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

class GmapUrlParserTest {

  @ParameterizedTest
  @CsvSource(
      delimiter = '|',
      value = {
        "21.0285, 105.8542                                                                 | 21.0285  | 105.8542",
        "https://www.google.com/maps/@21.0285,105.8542,17z                                 | 21.0285  | 105.8542",
        "https://www.google.com/maps/place/Nha/@21.02,105.80,17z/data=!3d21.0301!4d105.8467 | 21.0301  | 105.8467",
        "https://maps.google.com/?q=21.0285,105.8542                                       | 21.0285  | 105.8542",
        "https://www.google.com/maps?ll=-33.8688,151.2093&z=12                             | -33.8688 | 151.2093",
        "https://www.google.com/maps/search/21.0285,+105.8542?entry=tts                    | 21.0285  | 105.8542",
        "https://www.google.com/maps/search/?api=1&query=21.0285%2C105.8542                | 21.0285  | 105.8542",
      })
  void readsCoordinates(String input, double lat, double lng) {
    assertThat(GmapUrlParser.parse(input)).contains(new LatLng(lat, lng));
  }

  @Test
  void placePinWinsOverViewportCentre() {
    String url = "https://www.google.com/maps/place/X/@10.0,100.0,15z/data=!4m6!3m5!3d21.5!4d105.5";
    assertThat(GmapUrlParser.parse(url)).contains(new LatLng(21.5, 105.5));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "",
        "   ",
        "https://maps.app.goo.gl/AbCdEf123",
        "https://www.google.com/maps?q=Cộng+Cà+Phê",
        "91, 200",
        "https://www.google.com/maps/@95.0,105.0,17z",
        "abc%zz",
      })
  void rejectsInputWithoutValidCoordinates(String input) {
    assertThat(GmapUrlParser.parse(input)).isEmpty();
  }

  @Test
  void nullIsEmpty() {
    assertThat(GmapUrlParser.parse(null)).isEmpty();
  }
}
