package com.gfmaster.auth.social;

import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.error.ErrorCode;
import com.gfmaster.config.GfmProperties;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Kiểm tra access token Facebook mà SDK JavaScript trả cho frontend, qua Graph API:
 *
 * <ol>
 *   <li>{@code GET /debug_token?input_token=…&access_token=APP_ID|APP_SECRET}: token hợp lệ và cấp cho đúng app này
 *       (chặn token của app khác).
 *   <li>{@code GET /me?fields=id,name,email,picture}: lấy danh tính, kèm {@code appsecret_proof} (HMAC-SHA256 của token
 *       bằng app secret) như Facebook khuyến nghị.
 * </ol>
 *
 * Facebook chỉ trả email khi người dùng đã xác minh và không bỏ quyền email; thiếu email thì từ chối
 * ({@code SOCIAL_EMAIL_MISSING}) vì tài khoản HANOIVIBE cần email.
 */
@Component
public class FacebookTokenVerifier {

  private static final Logger log = LoggerFactory.getLogger(FacebookTokenVerifier.class);
  private static final ParameterizedTypeReference<Map<String, Object>> MAP = new ParameterizedTypeReference<>() {};

  private final String appId;
  private final String appSecret;
  private final RestClient http;

  public FacebookTokenVerifier(GfmProperties props, RestClient.Builder builder) {
    GfmProperties.Facebook f = props.social().facebook();
    this.appId = f.appId() == null ? "" : f.appId().strip();
    this.appSecret = f.appSecret() == null ? "" : f.appSecret().strip();
    this.http = builder.baseUrl(f.graphBaseUrl()).build();
  }

  public boolean enabled() {
    return !appId.isEmpty() && !appSecret.isEmpty();
  }

  public SocialIdentity verify(String accessToken) {
    if (!enabled()) throw new ApiException(ErrorCode.SOCIAL_LOGIN_DISABLED, "Đăng nhập Facebook chưa được bật.");
    if (accessToken == null || accessToken.isBlank()) throw new ApiException(ErrorCode.SOCIAL_TOKEN_INVALID);
    Map<String, Object> debug;
    Map<String, Object> me;
    try {
      Map<String, Object> wrapper =
          http.get()
              .uri(u -> u.path("/debug_token").queryParam("input_token", accessToken).queryParam("access_token", appId + "|" + appSecret).build())
              .retrieve()
              .body(MAP);
      debug = wrapper == null ? null : asMap(wrapper.get("data"));
      if (debug == null || !Boolean.TRUE.equals(debug.get("is_valid")) || !appId.equals(String.valueOf(debug.get("app_id")))) {
        log.info("Facebook token rejected: {}", debug);
        throw new ApiException(ErrorCode.SOCIAL_TOKEN_INVALID);
      }
      me =
          http.get()
              .uri(
                  u ->
                      u.path("/me")
                          .queryParam("fields", "id,name,email,picture.width(400)")
                          .queryParam("access_token", accessToken)
                          .queryParam("appsecret_proof", hmac(accessToken))
                          .build())
              .retrieve()
              .body(MAP);
    } catch (RestClientException e) {
      // Graph API trả 4xx cho token sai / hết hạn; 5xx hoặc mất mạng cũng coi như không xác minh được
      log.info("Facebook token check failed: {}", e.getMessage());
      throw new ApiException(ErrorCode.SOCIAL_TOKEN_INVALID);
    }
    if (me == null || me.get("id") == null) throw new ApiException(ErrorCode.SOCIAL_TOKEN_INVALID);
    String subject = String.valueOf(me.get("id"));
    if (!subject.equals(String.valueOf(debug.get("user_id")))) throw new ApiException(ErrorCode.SOCIAL_TOKEN_INVALID);
    Object email = me.get("email");
    if (email == null || String.valueOf(email).isBlank()) {
      throw new ApiException(ErrorCode.SOCIAL_EMAIL_MISSING, "Tài khoản Facebook không chia sẻ email. Hãy cho phép email hoặc đăng ký bằng email.");
    }
    return new SocialIdentity(SocialProvider.facebook, subject, String.valueOf(email), str(me.get("name")), pictureUrl(me));
  }

  private String hmac(String token) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(appSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      return HexFormat.of().formatHex(mac.doFinal(token.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException("Không tính được appsecret_proof", e);
    }
  }

  /** {@code picture: {data: {url, is_silhouette}}}; ảnh mặc định của Facebook thì bỏ */
  private static String pictureUrl(Map<String, Object> me) {
    Map<String, Object> picture = asMap(me.get("picture"));
    Map<String, Object> data = picture == null ? null : asMap(picture.get("data"));
    if (data == null || Boolean.TRUE.equals(data.get("is_silhouette"))) return null;
    return str(data.get("url"));
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> asMap(Object o) {
    return o instanceof Map<?, ?> m ? (Map<String, Object>) m : null;
  }

  private static String str(Object o) {
    return o == null ? null : String.valueOf(o);
  }
}
