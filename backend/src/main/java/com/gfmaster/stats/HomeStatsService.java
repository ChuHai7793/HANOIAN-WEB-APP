package com.gfmaster.stats;

import java.util.Map;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Con số thật cho trang chủ (công khai, không theo người dùng): số quán và chỗ chơi tuyển chọn, số đánh giá
 * và điểm trung bình, số plan đã lập. Cache trong Redis ({@code cache:home-stats::home}, TTL 5 phút): trang
 * chủ là trang mở nhiều nhất, số lệch vài phút không sao.
 */
@Service
public class HomeStatsService {

  public static final String CACHE = "home-stats";

  private final NamedParameterJdbcTemplate jdbc;

  public HomeStatsService(NamedParameterJdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  /** {@code ratingAvg} null khi chưa có đánh giá nào */
  public record HomeStats(long places, long spots, long reviews, Double ratingAvg, long plans) {}

  @Cacheable(cacheNames = CACHE, key = "'home'")
  @Transactional(readOnly = true)
  public HomeStats stats() {
    long places = count("SELECT count(*) FROM place_catalog");
    long spots = count("SELECT count(*) FROM date_spots");
    long reviews = count("SELECT count(*) FROM reviews");
    Double avg = reviews == 0 ? null : jdbc.queryForObject("SELECT avg(rating) FROM reviews", Map.of(), Double.class);
    long plans = count("SELECT count(*) FROM plans");
    return new HomeStats(places, spots, reviews, avg == null ? null : Math.round(avg * 10) / 10.0, plans);
  }

  private long count(String sql) {
    Long n = jdbc.queryForObject(sql, Map.of(), Long.class);
    return n == null ? 0 : n;
  }
}
