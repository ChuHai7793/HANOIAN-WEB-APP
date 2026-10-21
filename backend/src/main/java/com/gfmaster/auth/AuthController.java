package com.gfmaster.auth;

import com.gfmaster.auth.dto.AuthDtos.AuthResponse;
import com.gfmaster.auth.dto.AuthDtos.FacebookLoginRequest;
import com.gfmaster.auth.dto.AuthDtos.GoogleLoginRequest;
import com.gfmaster.auth.dto.AuthDtos.LoginRequest;
import com.gfmaster.auth.dto.AuthDtos.ProvidersResponse;
import com.gfmaster.auth.dto.AuthDtos.RegisterRequest;
import com.gfmaster.auth.dto.AuthDtos.UserResponse;
import com.gfmaster.auth.social.FacebookTokenVerifier;
import com.gfmaster.auth.social.GoogleTokenVerifier;
import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.error.ErrorCode;
import com.gfmaster.common.error.GlobalExceptionHandler;
import com.gfmaster.common.security.CurrentUser;
import com.gfmaster.config.GfmProperties;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

  private final AuthService auth;
  private final RefreshCookie cookie;
  private final List<String> allowedOrigins;
  private final GoogleTokenVerifier google;
  private final FacebookTokenVerifier facebook;
  private final GfmProperties.Social social;

  public AuthController(
      AuthService auth, RefreshCookie cookie, GfmProperties props, GoogleTokenVerifier google, FacebookTokenVerifier facebook) {
    this.auth = auth;
    this.cookie = cookie;
    this.allowedOrigins = props.corsOrigins();
    this.google = google;
    this.facebook = facebook;
    this.social = props.social();
  }

  @PostMapping("/register")
  public ResponseEntity<AuthResponse> register(
      @Valid @RequestBody RegisterRequest req,
      @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) String ua) {
    return withCookie(HttpStatus.CREATED, auth.register(req, ua));
  }

  @PostMapping("/login")
  public ResponseEntity<AuthResponse> login(
      @Valid @RequestBody LoginRequest req,
      @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) String ua) {
    return withCookie(HttpStatus.OK, auth.login(req, ua));
  }

  /** Cách đăng nhập ngoài đang bật (id công khai để frontend nạp SDK); không cần đăng nhập để hỏi. */
  @GetMapping("/providers")
  public ProvidersResponse providers() {
    return new ProvidersResponse(
        google.enabled() ? social.google().clientId().strip() : null,
        facebook.enabled() ? social.facebook().appId().strip() : null);
  }

  /** Đăng nhập / đăng ký bằng Google: body là ID token do Google Identity Services trả cho trình duyệt. */
  @PostMapping("/google")
  public ResponseEntity<AuthResponse> google(
      @Valid @RequestBody GoogleLoginRequest req,
      @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) String ua) {
    AuthService.Session session = auth.loginWithSocial(google.verify(req.credential()), ua);
    return withCookie(session.body().newUser() ? HttpStatus.CREATED : HttpStatus.OK, session);
  }

  /** Đăng nhập / đăng ký bằng Facebook: body là access token do Facebook JavaScript SDK trả cho trình duyệt. */
  @PostMapping("/facebook")
  public ResponseEntity<AuthResponse> facebook(
      @Valid @RequestBody FacebookLoginRequest req,
      @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) String ua) {
    AuthService.Session session = auth.loginWithSocial(facebook.verify(req.accessToken()), ua);
    return withCookie(session.body().newUser() ? HttpStatus.CREATED : HttpStatus.OK, session);
  }

  /** Đổi cookie rt lấy access token mới; cookie được xoay vòng (token cũ hết giá trị). */
  @PostMapping("/refresh")
  public ResponseEntity<?> refresh(
      @CookieValue(name = RefreshCookie.NAME, required = false) String refreshToken,
      @RequestHeader(value = HttpHeaders.USER_AGENT, required = false) String ua,
      HttpServletRequest request) {
    requireAllowedOrigin(request);
    try {
      return withCookie(HttpStatus.OK, auth.refresh(refreshToken, ua));
    } catch (ApiException e) {
      // Cookie hỏng/hết hạn/bị thu hồi: xoá luôn để trình duyệt thôi gửi
      return ResponseEntity.status(e.code().status())
          .header(HttpHeaders.SET_COOKIE, cookie.clear())
          .body(GlobalExceptionHandler.problem(e.code(), e.getMessage()));
    }
  }

  @PostMapping("/logout")
  public ResponseEntity<Void> logout(
      @CookieValue(name = RefreshCookie.NAME, required = false) String refreshToken,
      HttpServletRequest request) {
    requireAllowedOrigin(request);
    auth.logout(refreshToken);
    return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookie.clear()).build();
  }

  @PostMapping("/logout-all")
  public ResponseEntity<Void> logoutAll(@CurrentUser UUID userId) {
    auth.logoutAll(userId);
    return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookie.clear()).build();
  }

  @GetMapping("/me")
  public UserResponse me(@CurrentUser UUID userId) {
    return auth.me(userId);
  }

  private ResponseEntity<AuthResponse> withCookie(HttpStatus status, AuthService.Session session) {
    return ResponseEntity.status(status)
        .header(HttpHeaders.SET_COOKIE, cookie.create(session.refreshToken()))
        .body(session.body());
  }

  /**
   * Endpoint dùng cookie: ngoài SameSite=Strict, chặn thêm request có Origin lạ (chống CSRF).
   * Không có Origin (curl, app native) thì cho qua vì trình duyệt luôn gửi Origin với POST.
   */
  private void requireAllowedOrigin(HttpServletRequest request) {
    String origin = request.getHeader(HttpHeaders.ORIGIN);
    if (origin == null) return;
    String self = ServletUriComponentsBuilder.fromContextPath(request).replacePath(null).build().toUriString();
    if (!origin.equals(self) && !allowedOrigins.contains(origin)) {
      throw new ApiException(ErrorCode.FORBIDDEN, "Origin không được phép.");
    }
  }
}
