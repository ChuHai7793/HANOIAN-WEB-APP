package com.gfmaster.maps;

import com.gfmaster.maps.ShortLinkResolver.Resolved;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

/**
 * Giải link Google Maps, kết quả cache Redis 7 ngày ({@code cache:gmap-resolve::<url>}): cùng
 * một link thì lần sau trả ngay, không gọi Google nữa. Lỗi (ném exception) thì không cache.
 */
@Service
public class MapsService {

  public static final String CACHE = "gmap-resolve";

  private final ShortLinkResolver resolver;

  public MapsService(ShortLinkResolver resolver) {
    this.resolver = resolver;
  }

  @Cacheable(cacheNames = CACHE, key = "#url.trim()")
  public Resolved resolve(String url) {
    return resolver.resolve(url);
  }
}
