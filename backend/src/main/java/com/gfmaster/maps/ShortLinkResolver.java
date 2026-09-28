package com.gfmaster.maps;

import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.error.ErrorCode;
import com.gfmaster.maps.GmapUrlParser.LatLng;
import java.io.IOException;
import java.net.InetAddress;
import java.net.URI;
import java.net.URLDecoder;
import java.net.UnknownHostException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Giải link rút gọn ({@code maps.app.goo.gl/...}, {@code goo.gl/maps/...}) bằng cách tự đi theo
 * từng bước redirect (tối đa 5), rồi đọc toạ độ từ URL cuối bằng {@link GmapUrlParser}.
 *
 * <p>Chống SSRF (lợi dụng server gọi tới địa chỉ nội bộ): mỗi bước chỉ chấp nhận {@code https},
 * cổng mặc định, host thuộc danh sách Google; trước khi gọi, host còn phải không trỏ về IP nội bộ
 * (phòng DNS bị trỏ bậy). Không dùng
 * redirect tự động của HttpClient, vì như thế không kiểm tra được từng bước.
 */
@Component
public class ShortLinkResolver {

  private static final Logger log = LoggerFactory.getLogger(ShortLinkResolver.class);

  static final int MAX_REDIRECTS = 5;
  static final Set<String> ALLOWED_HOSTS =
      Set.of(
          "maps.app.goo.gl",
          "goo.gl",
          "google.com",
          "www.google.com",
          "maps.google.com",
          "google.com.vn",
          "www.google.com.vn");
  /** Trang xin đồng ý cookie (người dùng EU): URL thật nằm trong tham số {@code continue}. */
  private static final String CONSENT_HOST = "consent.google.com";

  public record Resolved(Double lat, Double lng, String resolvedUrl) {}

  /** Một bước HTTP: trả về status và header Location (nếu có). Tách ra để test không cần mạng. */
  interface Fetcher {
    Hop fetch(URI uri) throws IOException, InterruptedException;
  }

  record Hop(int status, String location) {}

  private final Fetcher fetcher;
  private final HostChecker hosts;

  /** Kiểm tra host không trỏ về mạng nội bộ. Tách ra để test không phụ thuộc DNS. */
  interface HostChecker {
    boolean isPublic(String host);
  }

  public ShortLinkResolver() {
    this(httpFetcher(), ShortLinkResolver::resolvesToPublicAddress);
  }

  ShortLinkResolver(Fetcher fetcher, HostChecker hosts) {
    this.fetcher = fetcher;
    this.hosts = hosts;
  }

  public Resolved resolve(String url) {
    URI current = checkAllowed(url);
    for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
      Optional<LatLng> coords = GmapUrlParser.parse(current.toString());
      if (coords.isPresent()) {
        return new Resolved(coords.get().lat(), coords.get().lng(), current.toString());
      }
      if (CONSENT_HOST.equals(current.getHost())) {
        current = checkAllowed(queryParam(current, "continue"));
        continue;
      }
      Hop response = fetch(current);
      if (response.status() < 300 || response.status() >= 400 || response.location() == null) {
        // Hết redirect mà URL không có toạ độ (ví dụ ?q=Tên+quán): vẫn trả link để lưu lại
        return new Resolved(null, null, current.toString());
      }
      current = checkAllowed(current.resolve(response.location()).toString());
    }
    throw new ApiException(ErrorCode.MAPS_RESOLVE_FAILED, "Link chuyển hướng quá nhiều lần.");
  }

  private Hop fetch(URI uri) {
    // Tra DNS ngay trước khi gọi: link đã có toạ độ thì không cần mạng, cũng không cần tra
    if (!hosts.isPublic(uri.getHost())) throw notAllowed();
    try {
      return fetcher.fetch(uri);
    } catch (IOException e) {
      log.warn("Maps resolve failed for {}: {}", uri.getHost(), e.toString());
      throw new ApiException(ErrorCode.MAPS_RESOLVE_FAILED);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new ApiException(ErrorCode.MAPS_RESOLVE_FAILED);
    }
  }

  /** https + cổng mặc định + host Google; sai thì 400 MAPS_URL_NOT_ALLOWED. */
  URI checkAllowed(String url) {
    URI uri;
    try {
      uri = URI.create(url == null ? "" : url.trim());
    } catch (IllegalArgumentException e) {
      throw notAllowed();
    }
    String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
    boolean ok =
        "https".equalsIgnoreCase(uri.getScheme())
            && uri.getPort() == -1
            && uri.getUserInfo() == null
            && (ALLOWED_HOSTS.contains(host) || CONSENT_HOST.equals(host));
    if (!ok) throw notAllowed();
    return uri;
  }

  private static ApiException notAllowed() {
    return new ApiException(ErrorCode.MAPS_URL_NOT_ALLOWED);
  }

  private static String queryParam(URI uri, String name) {
    String query = uri.getRawQuery();
    if (query == null) return null;
    for (String pair : query.split("&")) {
      int eq = pair.indexOf('=');
      if (eq > 0 && pair.substring(0, eq).equals(name)) {
        return URLDecoder.decode(pair.substring(eq + 1), StandardCharsets.UTF_8);
      }
    }
    return null;
  }

  static boolean resolvesToPublicAddress(String host) {
    try {
      for (InetAddress address : InetAddress.getAllByName(host)) {
        if (address.isLoopbackAddress()
            || address.isSiteLocalAddress()
            || address.isLinkLocalAddress()
            || address.isAnyLocalAddress()
            || address.isMulticastAddress()) {
          return false;
        }
      }
      return true;
    } catch (UnknownHostException e) {
      return false;
    }
  }

  private static Fetcher httpFetcher() {
    HttpClient client =
        HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NEVER)
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    return uri -> {
      HttpRequest request =
          HttpRequest.newBuilder(uri)
              .timeout(Duration.ofSeconds(5))
              .header("User-Agent", "Mozilla/5.0 (compatible; GFMaster/1.0)")
              .GET()
              .build();
      // Chỉ cần status và Location, bỏ qua body
      HttpResponse<Void> response = client.send(request, HttpResponse.BodyHandlers.discarding());
      return new Hop(response.statusCode(), response.headers().firstValue("Location").orElse(null));
    };
  }
}
