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
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ProblemDetail;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Chạy sau bước xác thực JWT. Login/register: giới hạn theo IP (chống dò mật khẩu). API khác:
 * giới hạn theo user. Vượt giới hạn → 429 RATE_LIMITED kèm Retry-After.
 *
 * <p>Không đánh dấu {@code @Component} để Spring Boot không tự đăng ký thêm lần nữa vào servlet
 * filter chain; filter được gắn vào SecurityFilterChain trong SecurityConfig.
 */
public class RateLimitFilter extends OncePerRequestFilter {

  private static final Set<String> AUTH_PATHS = Set.of("/api/v1/auth/login", "/api/v1/auth/register");

  private final RateLimiter limiter;
  private final ProblemSecurityHandlers problems;
  private final int authPerMinute;
  private final int apiPerMinute;

  public RateLimitFilter(RateLimiter limiter, ProblemSecurityHandlers problems, GfmProperties props) {
    this.limiter = limiter;
    this.problems = problems;
    this.authPerMinute = props.rateLimit().authPerMinute();
    this.apiPerMinute = props.rateLimit().apiPerMinute();
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    return !request.getRequestURI().startsWith("/api/");
  }

  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    RateLimiter.Decision decision = decide(request);
    if (decision != null && !decision.allowed()) {
      response.setHeader(HttpHeaders.RETRY_AFTER, String.valueOf(decision.retryAfterSeconds()));
      ProblemDetail problem =
          GlobalExceptionHandler.problem(ErrorCode.RATE_LIMITED, ErrorCode.RATE_LIMITED.defaultMessage());
      problem.setProperty("retryAfterSeconds", decision.retryAfterSeconds());
      problems.write(response, problem);
      return;
    }
    chain.doFilter(request, response);
  }

  private RateLimiter.Decision decide(HttpServletRequest request) {
    if ("POST".equals(request.getMethod()) && AUTH_PATHS.contains(request.getRequestURI())) {
      // remoteAddr đã được ForwardedHeaderFilter thay bằng IP thật khi chạy sau Caddy
      return limiter.tryConsume("auth:" + request.getRemoteAddr(), authPerMinute);
    }
    UUID userId = CurrentUserArgumentResolver.currentUserId();
    return userId == null ? null : limiter.tryConsume("api:" + userId, apiPerMinute);
  }
}
