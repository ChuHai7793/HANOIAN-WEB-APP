package com.gfmaster.stats;

import com.gfmaster.girlfriend.GirlfriendRepository;
import com.gfmaster.place.PlaceRepository;
import com.gfmaster.place.PlaceRepository.TypeCount;
import com.gfmaster.place.PlaceType;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Số lượng cho badge sidebar, cache trong Redis ({@code cache:stats::{userId}}, TTL 10 phút).
 * Cache bị xoá khi quán/người yêu thay đổi: service phát EntityChanged → queue gfm.cache.evict →
 * {@link #evict}. TTL là lưới an toàn nếu event bị mất.
 */
@Service
public class StatsService {

  public static final String CACHE = "stats";

  private final PlaceRepository places;
  private final GirlfriendRepository girlfriends;

  public StatsService(PlaceRepository places, GirlfriendRepository girlfriends) {
    this.places = places;
    this.girlfriends = girlfriends;
  }

  public record StatsResponse(long cafes, long bars, long restaurants, long girlfriends) {}

  @Cacheable(cacheNames = CACHE, key = "#userId")
  @Transactional(readOnly = true)
  public StatsResponse stats(UUID userId) {
    Map<PlaceType, Long> byType =
        places.countByType(userId).stream()
            .collect(Collectors.toMap(TypeCount::getType, TypeCount::getTotal));
    return new StatsResponse(
        byType.getOrDefault(PlaceType.cafe, 0L),
        byType.getOrDefault(PlaceType.bar, 0L),
        byType.getOrDefault(PlaceType.restaurant, 0L),
        girlfriends.countByUserId(userId));
  }

  // beforeInvocation = true: Spring gọi evictIfPresent (xoá ngay). Mặc định Spring gọi evict(),
  // hàm này được phép xoá trễ, nên ngay sau đó /stats vẫn có thể trả số cũ.
  @CacheEvict(cacheNames = CACHE, key = "#userId", beforeInvocation = true)
  public void evict(UUID userId) {}
}
