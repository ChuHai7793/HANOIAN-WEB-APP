package com.gfmaster.auth;

import com.gfmaster.config.GfmProperties;
import java.time.Duration;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/**
 * Cookie {@code rt} chứa refresh token: httpOnly (JS không đọc được), SameSite=Strict (không gửi
 * kèm request từ trang khác), chỉ gửi tới {@code /api/v1/auth}.
 */
@Component
public class RefreshCookie {

  public static final String NAME = "rt";
  static final String PATH = "/api/v1/auth";

  private final boolean secure;
  private final Duration maxAge;

  public RefreshCookie(GfmProperties props) {
    this.secure = props.auth().cookieSecure();
    this.maxAge = props.jwt().refreshTtl();
  }

  public String create(String token) {
    return base(token).maxAge(maxAge).build().toString();
  }

  public String clear() {
    return base("").maxAge(Duration.ZERO).build().toString();
  }

  private ResponseCookie.ResponseCookieBuilder base(String value) {
    return ResponseCookie.from(NAME, value).httpOnly(true).secure(secure).sameSite("Strict").path(PATH);
  }
}
