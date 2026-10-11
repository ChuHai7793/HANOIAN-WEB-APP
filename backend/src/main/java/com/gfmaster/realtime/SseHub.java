package com.gfmaster.realtime;

import java.io.IOException;
import java.time.Duration;
import java.util.Deque;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter.SseEventBuilder;

/**
 * Kết nối SSE đang mở trên <b>máy này</b>, theo người dùng (mỗi tab một kết nối). Không giữ thread nào
 * trong lúc chờ: SseEmitter là request bất đồng bộ.
 *
 * <p>Tin tới từ Redis ({@link RealtimeConfig}) nên máy nào giữ kết nối của người nhận thì máy đó đẩy.
 */
@Component
public class SseHub {

  /** Hết hạn thì trình duyệt tự nối lại (và lấy bù tin bị lỡ). */
  static final Duration TIMEOUT = Duration.ofMinutes(30);
  /** Quá số tab này thì đóng kết nối cũ nhất. */
  static final int MAX_PER_USER = 5;

  private final Map<UUID, Deque<SseEmitter>> byUser = new ConcurrentHashMap<>();

  public SseEmitter connect(UUID userId) {
    SseEmitter emitter = new SseEmitter(TIMEOUT.toMillis());
    byUser.compute(
        userId,
        (k, list) -> {
          Deque<SseEmitter> l = list == null ? new ConcurrentLinkedDeque<>() : list;
          l.add(emitter);
          return l;
        });
    emitter.onCompletion(() -> remove(userId, emitter));
    emitter.onTimeout(() -> remove(userId, emitter));
    emitter.onError(e -> remove(userId, emitter));
    Deque<SseEmitter> list = byUser.get(userId);
    while (list != null && list.size() > MAX_PER_USER) {
      SseEmitter oldest = list.poll();
      if (oldest != null) oldest.complete();
    }
    // Gửi ngay một sự kiện: trình duyệt biết đã nối, proxy đẩy header đi luôn
    send(userId, emitter, SseEmitter.event().name("ready").data("{}"));
    return emitter;
  }

  /** {@code data} là JSON đã dựng sẵn (gửi nguyên văn). */
  public void deliver(UUID userId, String type, String data) {
    Deque<SseEmitter> list = byUser.get(userId);
    if (list == null) return;
    for (SseEmitter e : list) send(userId, e, SseEmitter.event().name(type).data(data));
  }

  /** Proxy hay cắt kết nối im lặng lâu: 25 giây gửi một dòng chú thích. Chạy trên từng máy, không khoá. */
  @Scheduled(fixedDelay = 25_000, initialDelay = 25_000)
  void heartbeat() {
    byUser.forEach((userId, list) -> list.forEach(e -> send(userId, e, SseEmitter.event().comment("ping"))));
  }

  public int connections(UUID userId) {
    Deque<SseEmitter> list = byUser.get(userId);
    return list == null ? 0 : list.size();
  }

  private void send(UUID userId, SseEmitter emitter, SseEventBuilder event) {
    try {
      emitter.send(event);
    } catch (IOException | IllegalStateException e) {
      // Trình duyệt đã đóng tab / mất mạng
      remove(userId, emitter);
    }
  }

  private void remove(UUID userId, SseEmitter emitter) {
    byUser.computeIfPresent(
        userId,
        (k, list) -> {
          list.remove(emitter);
          return list.isEmpty() ? null : list;
        });
  }
}
