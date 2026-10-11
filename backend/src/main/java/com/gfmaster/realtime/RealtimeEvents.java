package com.gfmaster.realtime;

import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import tools.jackson.databind.json.JsonMapper;

/**
 * Đẩy một sự kiện tới mọi tab đang mở của một người dùng, dù kết nối nằm ở máy nào: phát lên Redis
 * pub/sub, máy giữ kết nối nhận và đẩy xuống ({@link RealtimeConfig}, {@link SseHub}).
 *
 * <p>Gọi trong transaction thì chỉ phát sau khi commit (không báo tin rồi lại rollback). Mất một sự kiện
 * (Redis trục trặc, đang nối lại) không mất dữ liệu: trình duyệt nối lại thì tự lấy bù qua API.
 */
@Component
public class RealtimeEvents {

  static final String CHANNEL = "gfm:realtime";
  private static final Logger log = LoggerFactory.getLogger(RealtimeEvents.class);

  /** Gói tin trên Redis; {@code data} là JSON của sự kiện. */
  record Envelope(UUID userId, String type, String data) {}

  private final StringRedisTemplate redis;
  private final JsonMapper json;

  public RealtimeEvents(StringRedisTemplate redis, JsonMapper json) {
    this.redis = redis;
    this.json = json;
  }

  public void send(UUID userId, String type, Object data) {
    String payload = json.writeValueAsString(new Envelope(userId, type, json.writeValueAsString(data)));
    if (TransactionSynchronizationManager.isSynchronizationActive()) {
      TransactionSynchronizationManager.registerSynchronization(
          new TransactionSynchronization() {
            @Override
            public void afterCommit() {
              publish(payload);
            }
          });
    } else {
      publish(payload);
    }
  }

  private void publish(String payload) {
    try {
      redis.convertAndSend(CHANNEL, payload);
    } catch (RuntimeException e) {
      log.warn("Không phát được sự kiện realtime: {}", e.getMessage());
    }
  }
}
