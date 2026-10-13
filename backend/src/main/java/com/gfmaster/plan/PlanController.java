package com.gfmaster.plan;

import com.gfmaster.common.security.CurrentUser;
import com.gfmaster.dating.DatingDtos.MessageView;
import com.gfmaster.plan.PlanDtos.AddStopRequest;
import com.gfmaster.plan.PlanDtos.AutoplanRequest;
import com.gfmaster.plan.PlanDtos.AutoplanResult;
import com.gfmaster.plan.PlanDtos.PlanRequest;
import com.gfmaster.plan.PlanDtos.PlanStatus;
import com.gfmaster.plan.PlanDtos.PlanSummary;
import com.gfmaster.plan.PlanDtos.PlanView;
import com.gfmaster.plan.PlanDtos.ReorderRequest;
import com.gfmaster.plan.PlanDtos.SaveToGirlfriendRequest;
import com.gfmaster.plan.PlanDtos.SaveToGirlfriendResult;
import com.gfmaster.plan.PlanDtos.ShareRequest;
import com.gfmaster.plan.PlanDtos.StopPatch;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.gfmaster.plan.PlanDtos.PublicLink;

/** Plan của người đang đăng nhập (guest cũng có plan riêng). */
@RestController
@RequestMapping("/api/v1/plans")
public class PlanController {

  private final PlanService service;

  public PlanController(PlanService service) {
    this.service = service;
  }

  public record StatusRequest(@NotNull PlanStatus status) {}

  @GetMapping
  public List<PlanSummary> list(@CurrentUser UUID me) {
    return service.list(me);
  }

  @PostMapping
  public ResponseEntity<PlanView> create(@CurrentUser UUID me, @Valid @RequestBody PlanRequest req) {
    return ResponseEntity.status(HttpStatus.CREATED).body(service.create(me, req));
  }

  @PostMapping("/autoplan")
  public ResponseEntity<AutoplanResult> autoplan(@CurrentUser UUID me, @Valid @RequestBody AutoplanRequest req) {
    return ResponseEntity.status(HttpStatus.CREATED).body(service.autoplan(me, req));
  }

  /** Chủ plan, hoặc người được rủ đi qua tin nhắn (chỉ đọc) */
  @GetMapping("/{id}")
  public PlanView get(@CurrentUser UUID me, @PathVariable UUID id) {
    return service.get(me, id);
  }

  @PutMapping("/{id}")
  public PlanView update(@CurrentUser UUID me, @PathVariable UUID id, @Valid @RequestBody PlanRequest req) {
    return service.update(me, id, req);
  }

  @PutMapping("/{id}/status")
  public PlanView status(@CurrentUser UUID me, @PathVariable UUID id, @Valid @RequestBody StatusRequest req) {
    return service.setStatus(me, id, req.status());
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@CurrentUser UUID me, @PathVariable UUID id) {
    service.delete(me, id);
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/{id}/stops")
  public PlanView addStop(@CurrentUser UUID me, @PathVariable UUID id, @Valid @RequestBody AddStopRequest req) {
    return service.addStop(me, id, req);
  }

  @PatchMapping("/{id}/stops/{stopId}")
  public PlanView updateStop(
      @CurrentUser UUID me, @PathVariable UUID id, @PathVariable UUID stopId, @Valid @RequestBody StopPatch patch) {
    return service.updateStop(me, id, stopId, patch);
  }

  @DeleteMapping("/{id}/stops/{stopId}")
  public PlanView deleteStop(@CurrentUser UUID me, @PathVariable UUID id, @PathVariable UUID stopId) {
    return service.deleteStop(me, id, stopId);
  }

  @PutMapping("/{id}/stops/order")
  public PlanView reorder(@CurrentUser UUID me, @PathVariable UUID id, @Valid @RequestBody ReorderRequest req) {
    return service.reorder(me, id, req.stopIds());
  }

  @PostMapping("/{id}/stops/{stopId}/swap")
  public PlanView swap(@CurrentUser UUID me, @PathVariable UUID id, @PathVariable UUID stopId) {
    return service.swapStop(me, id, stopId);
  }

  /** Rủ đi: gửi plan vào tin nhắn với một match */
  @PostMapping("/{id}/share")
  public ResponseEntity<MessageView> share(@CurrentUser UUID me, @PathVariable UUID id, @Valid @RequestBody ShareRequest req) {
    return ResponseEntity.status(HttpStatus.CREATED).body(service.share(me, id, req.matchId()));
  }

  /** Người được rủ chép plan về làm plan của mình */
  @PostMapping("/{id}/copy")
  public ResponseEntity<PlanView> copy(@CurrentUser UUID me, @PathVariable UUID id) {
    return ResponseEntity.status(HttpStatus.CREATED).body(service.copy(me, id));
  }

  /** Bật link công khai: ai có link cũng xem được (kể cả khách) */
  @PostMapping("/{id}/public-link")
  public PublicLink publicLink(@CurrentUser UUID me, @PathVariable UUID id) {
    return service.publicLink(me, id);
  }

  @DeleteMapping("/{id}/public-link")
  public ResponseEntity<Void> revokePublicLink(@CurrentUser UUID me, @PathVariable UUID id) {
    service.revokePublicLink(me, id);
    return ResponseEntity.noContent().build();
  }

  /** Chép plan công khai (từ link chia sẻ) về làm plan của mình */
  @PostMapping("/public/{token}/copy")
  public ResponseEntity<PlanView> copyPublic(@CurrentUser UUID me, @PathVariable String token) {
    return ResponseEntity.status(HttpStatus.CREATED).body(service.copyPublic(me, token));
  }

  /** Chỉ admin (SecurityConfig): gắn các quán trong plan vào Người yêu, kèm điểm và kỷ niệm */
  @PostMapping("/{id}/save-to-girlfriend")
  public SaveToGirlfriendResult saveToGirlfriend(
      @CurrentUser UUID me, @PathVariable UUID id, @Valid @RequestBody SaveToGirlfriendRequest req) {
    return service.saveToGirlfriend(me, id, req.girlfriendId());
  }
}
