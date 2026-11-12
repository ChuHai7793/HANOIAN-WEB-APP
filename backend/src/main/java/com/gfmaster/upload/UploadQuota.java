package com.gfmaster.upload;

import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.error.ErrorCode;
import com.gfmaster.config.GfmProperties;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Component;

/**
 * Hạn mức upload mỗi người mỗi ngày (giờ Việt Nam): số ảnh và tổng dung lượng khai báo, đếm trong Redis
 * ({@code quota:upload:{userId}:{ngày}}, tự hết hạn sau 2 ngày). Không có thì tài khoản tự đăng ký upload được
 * 100 ảnh × 12MB mỗi phút lên storage. Kiểm tra và cộng dồn trong một script để hai request đồng thời không lách.
 */
@Component
public class UploadQuota {

  private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");
  private static final Duration TTL = Duration.ofDays(2);

  /** KEYS[1] = khoá ngày; ARGV = bytes, maxFiles, maxBytes, ttl giây. Trả 1 nếu còn hạn mức (và đã cộng), 0 nếu hết. */
  private static final RedisScript<Long> RESERVE =
      new DefaultRedisScript<>(
          """
          local files = tonumber(redis.call('HGET', KEYS[1], 'files') or '0')
          local bytes = tonumber(redis.call('HGET', KEYS[1], 'bytes') or '0')
          if files + 1 > tonumber(ARGV[2]) or bytes + tonumber(ARGV[1]) > tonumber(ARGV[3]) then return 0 end
          redis.call('HINCRBY', KEYS[1], 'files', 1)
          redis.call('HINCRBY', KEYS[1], 'bytes', ARGV[1])
          redis.call('EXPIRE', KEYS[1], ARGV[4])
          return 1
          """,
          Long.class);

  private final StringRedisTemplate redis;
  private final GfmProperties.Quota quota;

  public UploadQuota(StringRedisTemplate redis, GfmProperties props) {
    this.redis = redis;
    this.quota = props.storage().quota();
  }

  /** Ghi nhận một ảnh {@code bytes} byte của {@code userId}; vượt hạn mức → 429 UPLOAD_QUOTA_EXCEEDED. */
  public void reserve(UUID userId, long bytes) {
    if (quota == null) return;
    String key = "quota:upload:" + userId + ":" + LocalDate.now(VN);
    Long ok =
        redis.execute(
            RESERVE,
            List.of(key),
            String.valueOf(Math.max(0, bytes)),
            String.valueOf(quota.dailyFiles()),
            String.valueOf(quota.dailyBytes().toBytes()),
            String.valueOf(TTL.toSeconds()));
    if (ok == null || ok == 0) throw new ApiException(ErrorCode.UPLOAD_QUOTA_EXCEEDED);
  }
}
