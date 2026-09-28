package com.gfmaster.stats;

import com.gfmaster.common.security.CurrentUser;
import com.gfmaster.stats.StatsService.StatsResponse;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Số lượng cho badge sidebar. */
@RestController
@RequestMapping("/api/v1/stats")
public class StatsController {

  private final StatsService service;

  public StatsController(StatsService service) {
    this.service = service;
  }

  @GetMapping
  public StatsResponse stats(@CurrentUser UUID userId) {
    return service.stats(userId);
  }
}
