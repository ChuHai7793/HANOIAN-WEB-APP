package com.gfmaster.auth;

import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.error.ErrorCode;
import com.gfmaster.config.GfmProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Component;

/**
 * Refresh token lưu trong Redis, chỉ lưu SHA-256 của token (lộ Redis cũng không dùng được).
 *
 * <ul>
 *   <li>{@code rt:{hash}} (hash): userId, family, ua, used — TTL = refresh-ttl
 *   <li>{@code user:{id}:rt} (set): mọi hash của user, để thu hồi hàng loạt
 *   <li>{@code rtf:{family}} (set): mọi hash cùng một chuỗi xoay vòng
 * </ul>
 *
 * <p>Mỗi lần refresh, token cũ được đánh dấu {@code used} (không xoá) và phát token mới cùng
 * family. Nếu ai đó dùng lại token đã dùng (bị đánh cắp), cả family bị thu hồi.
 */
@Component
public class RefreshTokenStore {

  private static final Logger log = LoggerFactory.getLogger(RefreshTokenStore.class);
  private static final SecureRandom RANDOM = new SecureRandom();

  /** Tăng used nguyên tử; trả -1 nếu token không tồn tại (không tạo key rác). */
  private static final RedisScript<Long> MARK_USED =
      new DefaultRedisScript<>(
          """
          if redis.call('EXISTS', KEYS[1]) == 0 then return -1 end
          return redis.call('HINCRBY', KEYS[1], 'used', 1)
          """,
          Long.class);

  private final StringRedisTemplate redis;
  private final Duration ttl;

  public RefreshTokenStore(StringRedisTemplate redis, GfmProperties props) {
    this.redis = redis;
    this.ttl = props.jwt().refreshTtl();
  }

  public record Rotation(UUID userId, String token) {}

  public Duration ttl() {
    return ttl;
  }

  /** Phiên đăng nhập mới (family mới). */
  public String issue(UUID userId, String userAgent) {
    return issue(userId, UUID.randomUUID().toString(), userAgent);
  }

  /** Đổi token cũ lấy token mới. Token lạ/hết hạn → 401; token đã dùng → thu hồi cả family, 401. */
  public Rotation rotate(String token, String userAgent) {
    String key = tokenKey(hash(token));
    Map<Object, Object> entry = redis.opsForHash().entries(key);
    if (entry.isEmpty()) {
      throw new ApiException(ErrorCode.UNAUTHORIZED, "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.");
    }
    UUID userId = UUID.fromString((String) entry.get("userId"));
    String family = (String) entry.get("family");

    Long used = redis.execute(MARK_USED, List.of(key));
    if (used == null || used < 0) {
      throw new ApiException(ErrorCode.UNAUTHORIZED, "Phiên đăng nhập đã hết hạn.");
    }
    if (used > 1) {
      log.warn("Refresh token reuse detected for user {}, revoking family {}", userId, family);
      revokeFamily(userId, family);
      throw new ApiException(ErrorCode.UNAUTHORIZED, "Phiên đăng nhập đã bị thu hồi, hãy đăng nhập lại.");
    }
    return new Rotation(userId, issue(userId, family, userAgent));
  }

  /** Đăng xuất phiên hiện tại: thu hồi cả family của token này. */
  public void revoke(String token) {
    Map<Object, Object> entry = redis.opsForHash().entries(tokenKey(hash(token)));
    if (entry.isEmpty()) return;
    revokeFamily(UUID.fromString((String) entry.get("userId")), (String) entry.get("family"));
  }

  /** Đăng xuất mọi thiết bị. */
  public void revokeAll(UUID userId) {
    String userKey = userKey(userId);
    Set<String> hashes = redis.opsForSet().members(userKey);
    List<String> keys = new ArrayList<>();
    if (hashes != null) hashes.forEach(h -> keys.add(tokenKey(h)));
    keys.add(userKey);
    redis.delete(keys);
  }

  private String issue(UUID userId, String family, String userAgent) {
    byte[] bytes = new byte[32];
    RANDOM.nextBytes(bytes);
    String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    String hash = hash(token);

    String key = tokenKey(hash);
    redis.opsForHash()
        .putAll(
            key,
            Map.of(
                "userId", userId.toString(),
                "family", family,
                "ua", userAgent == null ? "" : truncate(userAgent, 200),
                "used", "0"));
    redis.expire(key, ttl);
    redis.opsForSet().add(userKey(userId), hash);
    redis.expire(userKey(userId), ttl);
    redis.opsForSet().add(familyKey(family), hash);
    redis.expire(familyKey(family), ttl);
    return token;
  }

  private void revokeFamily(UUID userId, String family) {
    String familyKey = familyKey(family);
    Set<String> hashes = redis.opsForSet().members(familyKey);
    List<String> keys = new ArrayList<>();
    if (hashes != null && !hashes.isEmpty()) {
      hashes.forEach(h -> keys.add(tokenKey(h)));
      redis.opsForSet().remove(userKey(userId), hashes.toArray());
    }
    keys.add(familyKey);
    redis.delete(keys);
  }

  private static String tokenKey(String hash) {
    return "rt:" + hash;
  }

  private static String userKey(UUID userId) {
    return "user:" + userId + ":rt";
  }

  private static String familyKey(String family) {
    return "rtf:" + family;
  }

  private static String truncate(String s, int max) {
    return s.length() <= max ? s : s.substring(0, max);
  }

  static String hash(String token) {
    try {
      byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(digest);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
  }
}
