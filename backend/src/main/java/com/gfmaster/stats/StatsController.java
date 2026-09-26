package com.gfmaster.stats;

import com.gfmaster.common.security.CurrentUser;
import com.gfmaster.girlfriend.GirlfriendRepository;
import com.gfmaster.place.PlaceRepository;
import com.gfmaster.place.PlaceRepository.TypeCount;
import com.gfmaster.place.PlaceType;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Số lượng cho badge sidebar.
 *
 * <p>TODO(Phase 6): cache Redis {@code @Cacheable("stats")}, evict qua event RabbitMQ.
 */
@RestController
@RequestMapping("/api/v1/stats")
public class StatsController {

  private final PlaceRepository places;
  private final GirlfriendRepository girlfriends;

  public StatsController(PlaceRepository places, GirlfriendRepository girlfriends) {
    this.places = places;
    this.girlfriends = girlfriends;
  }

  public record StatsResponse(long cafes, long bars, long restaurants, long girlfriends) {}

  @GetMapping
  @Transactional(readOnly = true)
  public StatsResponse stats(@CurrentUser UUID userId) {
    Map<PlaceType, Long> byType =
        places.countByType(userId).stream()
            .collect(Collectors.toMap(TypeCount::getType, TypeCount::getTotal));
    return new StatsResponse(
        byType.getOrDefault(PlaceType.cafe, 0L),
        byType.getOrDefault(PlaceType.bar, 0L),
        byType.getOrDefault(PlaceType.restaurant, 0L),
        girlfriends.countByUserId(userId));
  }
}
