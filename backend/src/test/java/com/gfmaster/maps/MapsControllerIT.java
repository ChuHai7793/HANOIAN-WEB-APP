package com.gfmaster.maps;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gfmaster.support.ApiTestSupport;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.ResultActions;

/**
 * Chỉ dùng link đầy đủ (có sẵn toạ độ) và link bị chặn, nên test không gọi ra Internet. Luồng đi
 * theo redirect của link rút gọn được kiểm tra trong ShortLinkResolverTest bằng web giả.
 */
class MapsControllerIT extends ApiTestSupport {

  @Autowired StringRedisTemplate redis;

  @Test
  void fullLinkIsResolvedAndCachedForSevenDays() throws Exception {
    UUID user = newUser();
    // Mỗi test một URL riêng để không dính cache của lần chạy khác
    String url = "https://www.google.com/maps/@21.0285,105.8542,17z?test=" + UUID.randomUUID();

    resolve(user, url)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.lat").value(21.0285))
        .andExpect(jsonPath("$.lng").value(105.8542))
        .andExpect(jsonPath("$.resolvedUrl").value(url));

    String key = "cache:gmap-resolve::" + url;
    assertThat(redis.getExpire(key)).isGreaterThan(6 * 24 * 3600L);
    assertThat(redis.opsForValue().get(key)).contains("\"lat\":21.0285").doesNotContain("@class");
  }

  @Test
  void nonGoogleOrUnsafeUrlIsRejected() throws Exception {
    UUID user = newUser();
    resolve(user, "http://169.254.169.254/latest/meta-data/")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("MAPS_URL_NOT_ALLOWED"));
    resolve(user, "https://example.com/maps/abc").andExpect(status().isBadRequest());
    assertThat(redis.keys("cache:gmap-resolve::https://example.com*")).isEmpty();
  }

  @Test
  void requiresLogin() throws Exception {
    mvc.perform(get("/api/v1/maps/resolve").param("url", "https://maps.app.goo.gl/x"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void hasItsOwnStricterRateLimitPerUser() throws Exception {
    UUID user = newUser();
    String url = "https://www.google.com/maps/@21.03,105.85,17z?rl=" + UUID.randomUUID();
    for (int i = 0; i < 20; i++) {
      resolve(user, url).andExpect(status().isOk());
    }
    resolve(user, url)
        .andExpect(status().isTooManyRequests())
        .andExpect(jsonPath("$.code").value("RATE_LIMITED"))
        .andExpect(header().exists("Retry-After"));

    // API khác của cùng user và /maps/resolve của user khác không bị ảnh hưởng
    getAs(user, "/api/v1/stats").andExpect(status().isOk());
    resolve(newUser(), url).andExpect(status().isOk());
  }

  @Test
  void placeWithFullLinkButNoCoordinatesGetsThemOnSave() throws Exception {
    UUID user = newUser();
    String body =
        """
        {"type": "cafe", "name": "Có link", "priceRange": "cheap", "rating": 4, "openTime": "07:00",
         "closeTime": "22:00", "googleMapsUrl": "https://www.google.com/maps/place/X/data=!3d21.0301!4d105.8467"}
        """;
    postAs(user, "/api/v1/places", body)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.lat").value(21.0301))
        .andExpect(jsonPath("$.lng").value(105.8467));
  }

  // .param() thay vì nối vào path: get(String) coi path là URI template và mã hoá thêm một lần
  private ResultActions resolve(UUID user, String url) throws Exception {
    return mvc.perform(
        get("/api/v1/maps/resolve").param("url", url).header(HttpHeaders.AUTHORIZATION, bearer(user)));
  }
}
