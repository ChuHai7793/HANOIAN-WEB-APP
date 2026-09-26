package com.gfmaster.common.web;

import io.github.bucket4j.BucketConfiguration;
import io.github.bucket4j.ConsumptionProbe;
import io.github.bucket4j.distributed.ExpirationAfterWriteStrategy;
import io.github.bucket4j.distributed.proxy.ProxyManager;
import io.github.bucket4j.redis.lettuce.Bucket4jLettuce;
import io.lettuce.core.RedisClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.stereotype.Component;

/**
 * Token bucket dùng chung giữa các instance: trạng thái bucket nằm trong Redis (key {@code rl:...}),
 * tự hết hạn khi bucket đã đầy lại. Dùng lại RedisClient của Spring nên không cần cấu hình riêng.
 */
@Component
public class RateLimiter {

  private final ProxyManager<byte[]> buckets;

  public RateLimiter(LettuceConnectionFactory connectionFactory) {
    RedisClient client = (RedisClient) connectionFactory.getRequiredNativeClient();
    this.buckets =
        Bucket4jLettuce.casBasedBuilder(client)
            .expirationAfterWrite(
                ExpirationAfterWriteStrategy.basedOnTimeForRefillingBucketUpToMax(Duration.ofMinutes(1)))
            .build();
  }

  /** Kết quả: được phép hay không, và nếu không thì bao lâu nữa thử lại. */
  public record Decision(boolean allowed, long retryAfterSeconds) {}

  /** Tối đa {@code perMinute} request mỗi phút cho {@code key}, nạp lại dần đều. */
  public Decision tryConsume(String key, int perMinute) {
    BucketConfiguration config =
        BucketConfiguration.builder()
            .addLimit(limit -> limit.capacity(perMinute).refillGreedy(perMinute, Duration.ofMinutes(1)))
            .build();
    ConsumptionProbe probe =
        buckets.builder().build(("rl:" + key).getBytes(StandardCharsets.UTF_8), () -> config).tryConsumeAndReturnRemaining(1);
    if (probe.isConsumed()) {
      return new Decision(true, 0);
    }
    long seconds = Math.max(1, Duration.ofNanos(probe.getNanosToWaitForRefill()).toSeconds() + 1);
    return new Decision(false, seconds);
  }
}
