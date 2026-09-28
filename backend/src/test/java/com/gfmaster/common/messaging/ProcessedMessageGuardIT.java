package com.gfmaster.common.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.gfmaster.support.IntegrationTest;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;

@IntegrationTest
class ProcessedMessageGuardIT {

  @Autowired ProcessedMessageGuard guard;
  @Autowired StringRedisTemplate redis;

  @Test
  void sameMessageIdIsProcessedOnce() {
    String id = UUID.randomUUID().toString();
    AtomicInteger runs = new AtomicInteger();

    assertThat(guard.runOnce(id, runs::incrementAndGet)).isTrue();
    assertThat(guard.runOnce(id, runs::incrementAndGet)).isFalse();

    assertThat(runs).hasValue(1);
    assertThat(redis.getExpire("msg:done:" + id)).isGreaterThan(6 * 24 * 3600L);
  }

  @Test
  void failedAttemptCanBeRetried() {
    String id = UUID.randomUUID().toString();
    AtomicInteger runs = new AtomicInteger();

    assertThatThrownBy(() -> guard.runOnce(id, () -> {
          runs.incrementAndGet();
          throw new IllegalStateException("tạm thời lỗi");
        }))
        .isInstanceOf(IllegalStateException.class);
    assertThat(guard.runOnce(id, runs::incrementAndGet)).isTrue();

    assertThat(runs).hasValue(2);
  }

  @Test
  void messageWithoutIdIsAlwaysProcessed() {
    AtomicInteger runs = new AtomicInteger();
    guard.runOnce(null, runs::incrementAndGet);
    guard.runOnce(null, runs::incrementAndGet);
    assertThat(runs).hasValue(2);
  }
}
