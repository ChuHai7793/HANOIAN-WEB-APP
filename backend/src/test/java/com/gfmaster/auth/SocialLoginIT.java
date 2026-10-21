package com.gfmaster.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gfmaster.auth.social.SocialProvider;
import com.gfmaster.auth.social.TestGoogleTokens;
import com.gfmaster.support.ApiTestSupport;
import com.gfmaster.user.User;
import com.gfmaster.user.UserIdentityRepository;
import jakarta.servlet.http.Cookie;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Đăng nhập Google qua {@code POST /auth/google} với ID token do test ký (khoá trong application-test.yml). Facebook
 * dùng chung {@code AuthService.loginWithSocial} nên chỉ kiểm tra endpoint khi chưa cấu hình app.
 */
class SocialLoginIT extends ApiTestSupport {

  private static final String PASSWORD = "Matkhau@123";

  @Autowired UserIdentityRepository identities;

  /** Mỗi test một IP riêng để không dính giới hạn 5 lần/phút của test khác. */
  private final String ip = "10.%d.%d.%d".formatted(rnd(), rnd(), rnd());

  @Test
  void providersListsGoogleOnly() throws Exception {
    mvc.perform(get("/api/v1/auth/providers"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.googleClientId").value(TestGoogleTokens.CLIENT_ID))
        .andExpect(jsonPath("$.facebookAppId").isEmpty());
  }

  @Test
  void firstGoogleLoginCreatesGuestWithoutPassword() throws Exception {
    String sub = "g-" + UUID.randomUUID();
    String email = sub + "@gmail.test";
    MvcResult res =
        google(TestGoogleTokens.token(sub, email, "Mai Google"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.newUser").value(true))
            .andExpect(jsonPath("$.accessToken").isNotEmpty())
            .andExpect(jsonPath("$.user.email").value(email))
            .andExpect(jsonPath("$.user.displayName").value("Mai Google"))
            .andExpect(jsonPath("$.user.role").value("GUEST"))
            .andExpect(jsonPath("$.user.avatarUrl").value("https://lh3.googleusercontent.com/a/" + sub))
            .andReturn();
    assertThat(res.getResponse().getHeader(HttpHeaders.SET_COOKIE)).contains("rt=").contains("HttpOnly").contains("Path=/api/v1/auth");

    User user = users.findByEmailIgnoreCase(email).orElseThrow();
    assertThat(user.getPasswordHash()).isNull();
    assertThat(identities.findByProviderAndSubject(SocialProvider.google, sub)).isPresent();

    // Lần hai: cùng tài khoản, không phải tài khoản mới
    google(TestGoogleTokens.token(sub, email, "Mai Google"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.newUser").value(false))
        .andExpect(jsonPath("$.user.id").value(user.getId().toString()));

    // Tài khoản chỉ có Google: đăng nhập mật khẩu bị từ chối như sai mật khẩu
    mvc.perform(anon(post("/api/v1/auth/login")).contentType(MediaType.APPLICATION_JSON).content(loginJson(email, PASSWORD)))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
  }

  @Test
  void sameEmailLinksExistingAccountAndDropsPassword() throws Exception {
    String email = "u-" + UUID.randomUUID() + "@test.local";
    MvcResult registered =
        mvc.perform(
                anon(post("/api/v1/auth/register"))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\": \"%s\", \"password\": \"%s\", \"displayName\": \"Mai\"}".formatted(email, PASSWORD)))
            .andExpect(status().isCreated())
            .andReturn();
    String rt = refreshCookie(registered);
    UUID userId = UUID.fromString(body(registered).get("user").get("id").asString());

    // Google xác minh cùng email (khác hoa thường): liên kết vào tài khoản cũ, giữ tên hiển thị cũ
    google(TestGoogleTokens.token("sub-" + userId, email.toUpperCase(), "Mai Google"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.newUser").value(false))
        .andExpect(jsonPath("$.user.id").value(userId.toString()))
        .andExpect(jsonPath("$.user.displayName").value("Mai"));

    // Mật khẩu cũ hết dùng được, phiên cũ bị thu hồi (chống chiếm tài khoản trước bằng email chưa xác minh)
    assertThat(users.findById(userId).orElseThrow().getPasswordHash()).isNull();
    mvc.perform(anon(post("/api/v1/auth/login")).contentType(MediaType.APPLICATION_JSON).content(loginJson(email, PASSWORD)))
        .andExpect(status().isUnauthorized());
    mvc.perform(post("/api/v1/auth/refresh").cookie(new Cookie("rt", rt))).andExpect(status().isUnauthorized());
  }

  @Test
  void rejectsBadTokens() throws Exception {
    google("not-a-token").andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("SOCIAL_TOKEN_INVALID"));
    google(TestGoogleTokens.token(Map.of("sub", "s", "email", "s@gmail.test", "email_verified", false)))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("SOCIAL_EMAIL_MISSING"));
    google(TestGoogleTokens.token(Map.of("aud", "other-app", "sub", "s", "email", "s@gmail.test", "email_verified", true)))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("SOCIAL_TOKEN_INVALID"));
    mvc.perform(anon(post("/api/v1/auth/google")).contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isBadRequest());
  }

  @Test
  void facebookDisabledWithoutAppConfig() throws Exception {
    mvc.perform(anon(post("/api/v1/auth/facebook")).contentType(MediaType.APPLICATION_JSON).content("{\"accessToken\": \"x\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("SOCIAL_LOGIN_DISABLED"));
  }

  @Test
  void googleLoginIsRateLimitedPerIp() throws Exception {
    for (int i = 0; i < 5; i++) google("bad").andExpect(status().isUnauthorized());
    google("bad").andExpect(status().isTooManyRequests());
  }

  private ResultActions google(String credential) throws Exception {
    return mvc.perform(
        anon(post("/api/v1/auth/google"))
            .contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("credential", credential))));
  }

  private static String loginJson(String login, String password) {
    return "{\"login\": \"%s\", \"password\": \"%s\"}".formatted(login, password);
  }

  private MockHttpServletRequestBuilder anon(MockHttpServletRequestBuilder req) {
    return req.with(
        r -> {
          r.setRemoteAddr(ip);
          return r;
        });
  }

  private static String refreshCookie(MvcResult result) {
    String header = result.getResponse().getHeader(HttpHeaders.SET_COOKIE);
    assertThat(header).as("Set-Cookie").isNotNull();
    java.util.regex.Matcher m = java.util.regex.Pattern.compile("rt=([^;]*)").matcher(header);
    assertThat(m.find()).isTrue();
    return m.group(1);
  }

  private static int rnd() {
    return 1 + (int) (Math.random() * 250);
  }
}
