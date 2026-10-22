package com.gfmaster.stats;

import com.gfmaster.stats.HomeStatsService.HomeStats;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Không cần đăng nhập (SecurityConfig: {@code /api/v1/public/**}). */
@RestController
public class HomeStatsController {

  private final HomeStatsService service;

  public HomeStatsController(HomeStatsService service) {
    this.service = service;
  }

  @GetMapping("/api/v1/public/stats")
  public HomeStats stats() {
    return service.stats();
  }
}
