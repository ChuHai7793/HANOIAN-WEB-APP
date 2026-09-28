package com.gfmaster.maps;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.error.ErrorCode;
import com.gfmaster.maps.ShortLinkResolver.Hop;
import com.gfmaster.maps.ShortLinkResolver.Resolved;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** Không gọi mạng thật: mỗi URL được "trả lời" bằng một Hop dựng sẵn. */
class ShortLinkResolverTest {

  private final Map<String, Hop> web = new HashMap<>();
  private final List<String> fetched = new ArrayList<>();
  private final ShortLinkResolver resolver =
      new ShortLinkResolver(
          uri -> {
            fetched.add(uri.toString());
            Hop hop = web.get(uri.toString());
            if (hop == null) throw new IOException("không có trong web giả: " + uri);
            return hop;
          },
          host -> !host.equals("goo.gl"));

  @Test
  void followsRedirectsUntilCoordinatesAppear() {
    web.put("https://maps.app.goo.gl/abc", new Hop(302, "https://maps.app.goo.gl/xyz"));
    web.put("https://maps.app.goo.gl/xyz", new Hop(301, "https://www.google.com/maps/place/Q/@21.03,105.85,17z"));

    Resolved result = resolver.resolve("https://maps.app.goo.gl/abc");

    assertThat(result.lat()).isEqualTo(21.03);
    assertThat(result.lng()).isEqualTo(105.85);
    assertThat(result.resolvedUrl()).isEqualTo("https://www.google.com/maps/place/Q/@21.03,105.85,17z");
    // URL cuối đã có toạ độ nên không cần gọi tới nó
    assertThat(fetched).containsExactly("https://maps.app.goo.gl/abc", "https://maps.app.goo.gl/xyz");
  }

  @Test
  void relativeLocationIsResolvedAgainstCurrentUrl() {
    web.put("https://maps.app.goo.gl/rel", new Hop(302, "/maps?q=21.1,105.9"));

    assertThat(resolver.resolve("https://maps.app.goo.gl/rel").lat()).isEqualTo(21.1);
  }

  @Test
  void fullLinkWithCoordinatesNeedsNoNetwork() {
    Resolved result = resolver.resolve("https://www.google.com/maps/@21.0285,105.8542,17z");
    assertThat(result.lat()).isEqualTo(21.0285);
    assertThat(fetched).isEmpty();
  }

  @Test
  void finalPageWithoutCoordinatesReturnsNullsAndTheLink() {
    String byName = "https://www.google.com/maps?q=Nh%C3%A0+C%E1%BB%A7a+M%C3%A2u";
    web.put("https://maps.app.goo.gl/name", new Hop(302, byName));
    web.put(byName, new Hop(200, null));

    Resolved result = resolver.resolve("https://maps.app.goo.gl/name");

    assertThat(result.lat()).isNull();
    assertThat(result.lng()).isNull();
    assertThat(result.resolvedUrl()).isEqualTo(byName);
  }

  @Test
  void consentPageIsUnwrappedWithoutFetchingIt() {
    web.put(
        "https://maps.app.goo.gl/eu",
        new Hop(
            302,
            "https://consent.google.com/m?continue=https%3A%2F%2Fwww.google.com%2Fmaps%2F%4021.2%2C105.7%2C15z&gl=VN"));

    assertThat(resolver.resolve("https://maps.app.goo.gl/eu").lng()).isEqualTo(105.7);
    assertThat(fetched).containsExactly("https://maps.app.goo.gl/eu");
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "http://maps.app.goo.gl/abc",
        "https://maps.app.goo.gl:8443/abc",
        "https://user@maps.app.goo.gl/abc",
        "https://example.com/maps/abc",
        "https://maps.app.goo.gl.evil.com/abc",
        "file:///etc/passwd",
        "not a url",
      })
  void rejectsNonGoogleOrUnsafeUrls(String url) {
    assertThatThrownBy(() -> resolver.resolve(url))
        .isInstanceOfSatisfying(
            ApiException.class, e -> assertThat(e.code()).isEqualTo(ErrorCode.MAPS_URL_NOT_ALLOWED));
    assertThat(fetched).isEmpty();
  }

  @Test
  void allowedHostResolvingToPrivateAddressIsNotFetched() {
    // Máy test giả định goo.gl bị trỏ về IP nội bộ (DNS bị đầu độc)
    assertThatThrownBy(() -> resolver.resolve("https://goo.gl/maps/abc"))
        .isInstanceOfSatisfying(
            ApiException.class, e -> assertThat(e.code()).isEqualTo(ErrorCode.MAPS_URL_NOT_ALLOWED));
    assertThat(fetched).isEmpty();
  }

  @Test
  void redirectToInternalAddressIsBlocked() {
    web.put("https://maps.app.goo.gl/ssrf", new Hop(302, "http://169.254.169.254/latest/meta-data/"));

    assertThatThrownBy(() -> resolver.resolve("https://maps.app.goo.gl/ssrf"))
        .isInstanceOfSatisfying(
            ApiException.class, e -> assertThat(e.code()).isEqualTo(ErrorCode.MAPS_URL_NOT_ALLOWED));
    assertThat(fetched).containsExactly("https://maps.app.goo.gl/ssrf");
  }

  @Test
  void tooManyRedirectsFails() {
    for (int i = 0; i <= ShortLinkResolver.MAX_REDIRECTS + 1; i++) {
      web.put("https://maps.app.goo.gl/loop" + i, new Hop(302, "https://maps.app.goo.gl/loop" + (i + 1)));
    }
    assertThatThrownBy(() -> resolver.resolve("https://maps.app.goo.gl/loop0"))
        .isInstanceOfSatisfying(
            ApiException.class, e -> assertThat(e.code()).isEqualTo(ErrorCode.MAPS_RESOLVE_FAILED));
    assertThat(fetched).hasSize(ShortLinkResolver.MAX_REDIRECTS + 1);
  }

  @Test
  void networkErrorBecomesBadGateway() {
    assertThatThrownBy(() -> resolver.resolve("https://maps.app.goo.gl/down"))
        .isInstanceOfSatisfying(
            ApiException.class, e -> assertThat(e.code()).isEqualTo(ErrorCode.MAPS_RESOLVE_FAILED));
  }

  @Test
  void loopbackAndPrivateAddressesAreNotPublic() {
    assertThat(ShortLinkResolver.resolvesToPublicAddress("localhost")).isFalse();
    assertThat(ShortLinkResolver.resolvesToPublicAddress("127.0.0.1")).isFalse();
    assertThat(ShortLinkResolver.resolvesToPublicAddress("10.1.2.3")).isFalse();
    assertThat(ShortLinkResolver.resolvesToPublicAddress("192.168.0.1")).isFalse();
    assertThat(ShortLinkResolver.resolvesToPublicAddress("169.254.169.254")).isFalse();
    assertThat(ShortLinkResolver.resolvesToPublicAddress("8.8.8.8")).isTrue();
  }
}
