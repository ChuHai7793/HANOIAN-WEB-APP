package com.gfmaster.plan;

import com.gfmaster.plan.PlanDtos.AutoplanRequest;
import com.gfmaster.plan.PlanDtos.AutoplanResult;
import com.gfmaster.plan.PlanDtos.PlanView;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Không cần đăng nhập (SecurityConfig): thử Autoplan, xem plan được chia sẻ công khai. */
@RestController
@RequestMapping("/api/v1/public")
public class PublicPlanController {

  private final PlanService service;

  public PublicPlanController(PlanService service) {
    this.service = service;
  }

  /** Dựng lịch trình nhưng không lưu */
  @PostMapping("/autoplan")
  public AutoplanResult autoplan(@Valid @RequestBody AutoplanRequest req) {
    return service.preview(req);
  }

  @GetMapping("/plans/{token}")
  public PlanView plan(@PathVariable String token) {
    return service.getPublic(token);
  }
}
