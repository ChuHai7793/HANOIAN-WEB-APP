package com.gfmaster.common.web;

import com.gfmaster.common.error.ErrorCode;
import com.gfmaster.common.error.GlobalExceptionHandler;
import com.gfmaster.common.security.CurrentUserArgumentResolver;
import com.gfmaster.common.security.ProblemSecurityHandlers;
import com.gfmaster.config.GfmProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;
import tools.jackson.databind.json.JsonMapper;

/**
 * POST có header {@code Idempotency-Key}: cùng user + cùng key chỉ được xử lý một lần. Lần gửi
 * lại nhận nguyên response đã lưu (status + body) kèm header {@code Idempotent-Replayed: true}.
 *
 * <ol>
 *   <li>{@code SET idem:{userId}:{key} <đang xử lý> NX EX in-progress-ttl}
 *   <li>Không set được: đang xử lý → 409 IDEMPOTENCY_IN_PROGRESS; đã xong → trả lại response cũ;
 *       key đã dùng cho đường dẫn khác → 422 IDEMPOTENCY_KEY_REUSED.
 *   <li>Set được: xử lý bình thường rồi lưu response với TTL dài. Lỗi 5xx (hoặc 401/403/429) thì
 *       xoá key để client thử lại được với cùng key.
 * </ol>
 *
 * <p>Chạy sau RateLimitFilter (cần userId từ JWT). Không áp dụng cho /auth/** để không lưu token
 * vào Redis. Gắn vào SecurityFilterChain trong SecurityConfig, không đánh dấu {@code @Component}.
 */
public class IdempotencyFilter extends OncePerRequestFilter {

  public static final String HEADER = "Idempotency-Key";
  public static final String REPLAYED_HEADER = "Idempotent-Replayed";

  private static final Pattern KEY_FORMAT = Pattern.compile("[A-Za-z0-9_-]{8,100}");
  /** Status không lưu lại: lỗi tạm thời, gửi lại có thể thành công. */
  private static final Set<Integer> NOT_CACHED = Set.of(401, 403, 408, 429);

  /** Giá trị lưu trong Redis. {@code status == 0} nghĩa là đang xử lý. */
  record Stored(String path, int status, String contentType, String location, String body) {
    boolean inProgress() {
      return status == 0;
    }
  }

  private final StringRedisTemplate redis;
  private final JsonMapper json;
  private final ProblemSecurityHandlers problems;
  private final Duration ttl;
  private final Duration inProgressTtl;

  public IdempotencyFilter(
      StringRedisTemplate redis, JsonMapper json, ProblemSecurityHandlers problems, GfmProperties props) {
    this.redis = redis;
    this.json = json;
    this.problems = problems;
    this.ttl = props.idempotency().ttl();
    this.inProgressTtl = props.idempotency().inProgressTtl();
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    String uri = request.getRequestURI();
    return !"POST".equals(request.getMethod())
        || !uri.startsWith("/api/")
        || uri.startsWith("/api/v1/auth/")
        || request.getHeader(HEADER) == null;
  }

  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    UUID userId = CurrentUserArgumentResolver.currentUserId();
    if (userId == null) {
      // Chưa đăng nhập: AuthorizationFilter phía sau sẽ trả 401
      chain.doFilter(request, response);
      return;
    }
    String key = request.getHeader(HEADER);
    if (!KEY_FORMAT.matcher(key).matches()) {
      problems.write(
          response,
          GlobalExceptionHandler.problem(
              ErrorCode.MALFORMED_REQUEST, "Idempotency-Key phải gồm 8–100 ký tự chữ, số, '-' hoặc '_'."));
      return;
    }

    String redisKey = "idem:" + userId + ":" + key;
    String path = request.getRequestURI();
    Boolean acquired = redis.opsForValue().setIfAbsent(redisKey, write(new Stored(path, 0, null, null, null)), inProgressTtl);

    if (!Boolean.TRUE.equals(acquired)) {
      String raw = redis.opsForValue().get(redisKey);
      if (raw == null) {
        // Vừa hết hạn hoặc vừa bị xoá (request trước lỗi 5xx): coi như đang xử lý, client thử lại sau
        problems.write(response, ErrorCode.IDEMPOTENCY_IN_PROGRESS);
        return;
      }
      replayOrReject(json.readValue(raw, Stored.class), path, response);
      return;
    }

    ContentCachingResponseWrapper wrapper = new ContentCachingResponseWrapper(response);
    boolean saved = false;
    try {
      chain.doFilter(request, wrapper);
      int status = wrapper.getStatus();
      if (status < 500 && !NOT_CACHED.contains(status)) {
        Stored done =
            new Stored(
                path,
                status,
                wrapper.getContentType(),
                wrapper.getHeader(HttpHeaders.LOCATION),
                new String(wrapper.getContentAsByteArray(), StandardCharsets.UTF_8));
        redis.opsForValue().set(redisKey, write(done), ttl);
        saved = true;
      }
    } finally {
      if (!saved) {
        redis.delete(redisKey);
      }
      wrapper.copyBodyToResponse();
    }
  }

  private void replayOrReject(Stored stored, String path, HttpServletResponse response) throws IOException {
    if (!stored.path().equals(path)) {
      problems.write(response, ErrorCode.IDEMPOTENCY_KEY_REUSED);
    } else if (stored.inProgress()) {
      problems.write(response, ErrorCode.IDEMPOTENCY_IN_PROGRESS);
    } else {
      response.setStatus(stored.status());
      if (stored.contentType() != null) response.setContentType(stored.contentType());
      if (stored.location() != null) response.setHeader(HttpHeaders.LOCATION, stored.location());
      response.setHeader(REPLAYED_HEADER, "true");
      byte[] body = stored.body() == null ? new byte[0] : stored.body().getBytes(StandardCharsets.UTF_8);
      response.setContentLength(body.length);
      response.getOutputStream().write(body);
    }
  }

  private String write(Stored stored) {
    return json.writeValueAsString(stored);
  }
}
