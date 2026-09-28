package com.gfmaster.common.messaging;

import java.time.Duration;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * RabbitMQ giao message "ít nhất một lần": cùng một message có thể đến hai lần (mất ack, publish
 * lại). Guard ghi {@code msg:done:{messageId}} để lần sau bỏ qua.
 *
 * <p>Đánh dấu trước khi xử lý ({@code SET NX}), lỗi thì xoá dấu để lần retry vẫn chạy được.
 */
@Component
public class ProcessedMessageGuard {

  static final Duration TTL = Duration.ofDays(7);

  private final StringRedisTemplate redis;

  public ProcessedMessageGuard(StringRedisTemplate redis) {
    this.redis = redis;
  }

  /** Chạy {@code work} nếu {@code messageId} chưa từng được xử lý. Trả false nếu bỏ qua. */
  public boolean runOnce(String messageId, Runnable work) {
    if (messageId == null) {
      // Message không có id (gửi tay từ RabbitMQ UI...): không chống trùng được, cứ xử lý
      work.run();
      return true;
    }
    String key = "msg:done:" + messageId;
    if (!Boolean.TRUE.equals(redis.opsForValue().setIfAbsent(key, "1", TTL))) {
      return false;
    }
    try {
      work.run();
      return true;
    } catch (RuntimeException e) {
      redis.delete(key);
      throw e;
    }
  }
}
