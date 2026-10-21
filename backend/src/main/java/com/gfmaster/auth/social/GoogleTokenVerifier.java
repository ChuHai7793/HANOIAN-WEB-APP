package com.gfmaster.auth.social;

import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.error.ErrorCode;
import com.gfmaster.config.GfmProperties;
import java.security.KeyFactory;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtClaimNames;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.MappedJwtClaimSetConverter;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

/**
 * Kiểm tra ID token Google (JWT do Google ký) mà Google Identity Services trả cho frontend: chữ ký theo JWKS công
 * khai của Google (Nimbus tự cache), {@code iss}, {@code aud} đúng Client ID của app, chưa hết hạn, email đã xác
 * minh. Không gọi Google API nào khác, không cần client secret.
 *
 * <p>Test đặt {@code gfm.social.google.public-key-pem}: kiểm tra chữ ký bằng khoá công khai của test thay cho JWKS.
 */
@Component
public class GoogleTokenVerifier {

  private static final Logger log = LoggerFactory.getLogger(GoogleTokenVerifier.class);
  private static final Set<String> ISSUERS = Set.of("accounts.google.com", "https://accounts.google.com");

  private final String clientId;
  private final String jwkSetUri;
  private final String publicKeyPem;
  private volatile JwtDecoder decoder;

  public GoogleTokenVerifier(GfmProperties props) {
    GfmProperties.Google g = props.social().google();
    this.clientId = g.clientId() == null ? "" : g.clientId().strip();
    this.jwkSetUri = g.jwkSetUri();
    this.publicKeyPem = g.publicKeyPem();
  }

  /** Test đơn vị: decoder dựng sẵn từ khoá của test. */
  GoogleTokenVerifier(String clientId, JwtDecoder decoder) {
    this.clientId = clientId;
    this.jwkSetUri = null;
    this.publicKeyPem = null;
    this.decoder = decoder;
  }

  public boolean enabled() {
    return !clientId.isEmpty();
  }

  public SocialIdentity verify(String credential) {
    if (!enabled()) throw new ApiException(ErrorCode.SOCIAL_LOGIN_DISABLED, "Đăng nhập Google chưa được bật.");
    if (credential == null || credential.isBlank()) throw new ApiException(ErrorCode.SOCIAL_TOKEN_INVALID);
    Jwt jwt;
    try {
      jwt = decoder().decode(credential);
    } catch (JwtException | IllegalArgumentException e) {
      log.info("Google token rejected: {}", e.getMessage());
      throw new ApiException(ErrorCode.SOCIAL_TOKEN_INVALID);
    }
    String email = jwt.getClaimAsString("email");
    if (email == null || email.isBlank() || !Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified"))) {
      throw new ApiException(ErrorCode.SOCIAL_EMAIL_MISSING, "Tài khoản Google chưa xác minh email.");
    }
    return new SocialIdentity(
        SocialProvider.google, jwt.getSubject(), email, jwt.getClaimAsString("name"), jwt.getClaimAsString("picture"));
  }

  private JwtDecoder decoder() {
    JwtDecoder d = decoder;
    if (d == null) {
      synchronized (this) {
        if (decoder == null) decoder = build();
        d = decoder;
      }
    }
    return d;
  }

  private JwtDecoder build() {
    NimbusJwtDecoder d =
        publicKeyPem != null && !publicKeyPem.isBlank()
            ? NimbusJwtDecoder.withPublicKey(parsePublicKey(publicKeyPem)).build()
            : NimbusJwtDecoder.withJwkSetUri(jwkSetUri).build();
    return configure(d, clientId);
  }

  /**
   * Giữ {@code iss} là chuỗi (Google có thể trả "accounts.google.com" không có scheme, bộ chuyển mặc định của Spring
   * ép sang URL sẽ lỗi) và gắn bộ kiểm tra claim.
   */
  static NimbusJwtDecoder configure(NimbusJwtDecoder d, String clientId) {
    d.setClaimSetConverter(MappedJwtClaimSetConverter.withDefaults(Map.of(JwtClaimNames.ISS, v -> v)));
    d.setJwtValidator(validator(clientId));
    return d;
  }

  /** iss của Google, aud chứa Client ID của app, còn hạn (lệch tối đa 60 giây mặc định). */
  static OAuth2TokenValidator<Jwt> validator(String clientId) {
    OAuth2TokenValidator<Jwt> claims =
        jwt -> {
          String iss = jwt.getClaimAsString(JwtClaimNames.ISS);
          if (iss == null || !ISSUERS.contains(iss)) return fail("iss không phải Google");
          List<String> aud = jwt.getAudience();
          if (aud == null || !aud.contains(clientId)) return fail("aud không phải app này");
          return OAuth2TokenValidatorResult.success();
        };
    JwtTimestampValidator timestamps = new JwtTimestampValidator();
    return jwt -> {
      OAuth2TokenValidatorResult r = timestamps.validate(jwt);
      return r.hasErrors() ? r : claims.validate(jwt);
    };
  }

  private static OAuth2TokenValidatorResult fail(String reason) {
    return OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", reason, null));
  }

  static RSAPublicKey parsePublicKey(String pem) {
    try {
      String body = pem.replaceAll("-----[A-Z ]+-----", "").replaceAll("\\s", "");
      return (RSAPublicKey) KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(Base64.getDecoder().decode(body)));
    } catch (Exception e) {
      throw new IllegalStateException("gfm.social.google.public-key-pem không phải khoá RSA PEM hợp lệ", e);
    }
  }
}
