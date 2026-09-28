package com.gfmaster.importer;

import com.gfmaster.config.GfmProperties;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Component;

/**
 * Mỗi user chỉ một lần import chạy tại một thời điểm: {@code lock:import:{userId}}.
 *
 * <p>Khoá lấy ở request API nhưng nhả ở consumer (luồng khác, có thể instance khác), nên không dùng
 * khoá gắn với luồng (Redisson RLock). Giá trị khoá là một token ngẫu nhiên; chỉ ai giữ đúng token
 * mới nhả được, để consumer chạy chậm không nhả nhầm khoá của lần import sau. TTL là lưới an toàn
 * khi consumer chết giữa chừng.
 */
@Component
public class ImportLock {

  /** Xoá khoá chỉ khi giá trị vẫn là token của mình (so sánh và xoá nguyên tử). */
  private static final RedisScript<Long> RELEASE =
      new DefaultRedisScript<>(
          """
          if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
          return 0
          """,
          Long.class);

  private final StringRedisTemplate redis;
  private final Duration ttl;

  public ImportLock(StringRedisTemplate redis, GfmProperties props) {
    this.redis = redis;
    this.ttl = props.importer().lockTtl();
  }

  /** Trả về token nếu lấy được khoá, null nếu đang có import khác. */
  public String tryAcquire(UUID userId) {
    String token = UUID.randomUUID().toString();
    return Boolean.TRUE.equals(redis.opsForValue().setIfAbsent(key(userId), token, ttl)) ? token : null;
  }

  public void release(UUID userId, String token) {
    if (token != null) redis.execute(RELEASE, List.of(key(userId)), token);
  }

  public static String key(UUID userId) {
    return "lock:import:" + userId;
  }
}
