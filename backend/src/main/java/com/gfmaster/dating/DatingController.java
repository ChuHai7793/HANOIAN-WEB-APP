package com.gfmaster.dating;

import com.gfmaster.common.security.CurrentUser;
import com.gfmaster.dating.DatingDtos.BlockRequest;
import com.gfmaster.dating.DatingDtos.Candidate;
import com.gfmaster.dating.DatingDtos.DatingSettings;
import com.gfmaster.dating.DatingDtos.DatingSettingsRequest;
import com.gfmaster.dating.DatingDtos.MatchView;
import com.gfmaster.dating.DatingDtos.MessageView;
import com.gfmaster.dating.DatingDtos.ReportRequest;
import com.gfmaster.dating.DatingDtos.SendMessageRequest;
import com.gfmaster.dating.DatingDtos.SwipeRequest;
import com.gfmaster.dating.DatingDtos.SwipeResult;
import com.gfmaster.dating.DatingDtos.UndoResult;
import com.gfmaster.realtime.SseHub;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** "Tìm đối tượng" của người đang đăng nhập (guest cũng dùng được; SecurityConfig mở /dating/**). */
@RestController
@RequestMapping("/api/v1/dating")
public class DatingController {

  private final DatingService service;
  private final SseHub hub;

  public DatingController(DatingService service, SseHub hub) {
    this.service = service;
    this.hub = hub;
  }

  @GetMapping("/settings")
  public DatingSettings settings(@CurrentUser UUID me) {
    return service.settings(me);
  }

  @PutMapping("/settings")
  public DatingSettings saveSettings(@CurrentUser UUID me, @Valid @RequestBody DatingSettingsRequest request) {
    return service.saveSettings(me, request);
  }

  @GetMapping("/deck")
  public List<Candidate> deck(@CurrentUser UUID me) {
    return service.deck(me);
  }

  @PostMapping("/swipes")
  public SwipeResult swipe(@CurrentUser UUID me, @Valid @RequestBody SwipeRequest request) {
    return service.swipe(me, request.targetId(), request.liked());
  }

  @DeleteMapping("/swipes/last")
  public UndoResult undo(@CurrentUser UUID me) {
    return service.undo(me);
  }

  @GetMapping("/matches")
  public List<MatchView> matches(@CurrentUser UUID me) {
    return service.matches(me);
  }

  @DeleteMapping("/matches/{id}")
  public ResponseEntity<Void> unmatch(@CurrentUser UUID me, @PathVariable UUID id) {
    service.unmatch(me, id);
    return ResponseEntity.noContent().build();
  }

  /**
   * Kết nối SSE: tin nhắn, đã xem, match mới, bỏ match được đẩy xuống ngay. Ngắt thì trình duyệt tự nối
   * lại và lấy bù qua các API thường.
   */
  @GetMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
  public SseEmitter stream(@CurrentUser UUID me, HttpServletResponse response) {
    response.setHeader(HttpHeaders.CACHE_CONTROL, "no-cache");
    // Proxy (nginx…) không gom dữ liệu lại, đẩy từng sự kiện đi ngay
    response.setHeader("X-Accel-Buffering", "no");
    return hub.connect(me);
  }

  /** {@code after}: chỉ tin mới hơn (hỏi định kỳ); {@code before}: tin cũ hơn (cuộn lên). */
  @GetMapping("/matches/{id}/messages")
  public List<MessageView> messages(
      @CurrentUser UUID me,
      @PathVariable UUID id,
      @RequestParam(required = false) Instant after,
      @RequestParam(required = false) Instant before) {
    return service.messages(me, id, after, before);
  }

  @PostMapping("/matches/{id}/messages")
  public ResponseEntity<MessageView> send(
      @CurrentUser UUID me, @PathVariable UUID id, @Valid @RequestBody SendMessageRequest request) {
    return ResponseEntity.status(HttpStatus.CREATED).body(service.send(me, id, request.body()));
  }

  @PostMapping("/matches/{id}/read")
  public ResponseEntity<Void> markRead(@CurrentUser UUID me, @PathVariable UUID id) {
    service.markRead(me, id);
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/blocks")
  public ResponseEntity<Void> block(@CurrentUser UUID me, @Valid @RequestBody BlockRequest request) {
    service.block(me, request.userId());
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/reports")
  public ResponseEntity<Void> report(@CurrentUser UUID me, @Valid @RequestBody ReportRequest request) {
    service.report(me, request.userId(), request.reason(), request.note(), request.block());
    return ResponseEntity.status(HttpStatus.CREATED).build();
  }
}
