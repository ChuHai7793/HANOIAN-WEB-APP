package com.gfmaster.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gfmaster.support.ApiTestSupport;
import jakarta.servlet.http.Cookie;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

class AuthControllerIT extends ApiTestSupport {

  private static final String PASSWORD = "Matkhau@123";
  private static final Pattern RT = Pattern.compile("rt=([^;]*)");

  /** Mỗi test một IP riêng để không dính giới hạn 5 lần/phút của test khác. */
  private final String ip = "10.%d.%d.%d".formatted(rnd(), rnd(), rnd());

  // ---------- Đăng ký / đăng nhập ----------

  @Test
  void registerReturnsTokenAndSecureRefreshCookie() throws Exception {
    String email = "Mai." + UUID.randomUUID() + "@Test.Local";
    MvcResult res =
        register(email)
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.accessToken").isNotEmpty())
            .andExpect(jsonPath("$.expiresIn").value(900))
            .andExpect(jsonPath("$.user.email").value(email.toLowerCase()))
            .andReturn();

    String setCookie = res.getResponse().getHeader(HttpHeaders.SET_COOKIE);
    assertThat(setCookie)
        .contains("rt=")
        .contains("HttpOnly")
        .contains("SameSite=Strict")
        .contains("Path=/api/v1/auth")
        .contains("Secure");

    String token = body(res).get("accessToken").asString();
    mvc.perform(get("/api/v1/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.displayName").value("Mai"));
  }

  @Test
  void duplicateEmailIsCaseInsensitive() throws Exception {
    String email = "dup-" + UUID.randomUUID() + "@test.local";
    register(email).andExpect(status().isCreated());
    register(email.toUpperCase())
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("EMAIL_TAKEN"));
  }

  @Test
  void weakPasswordRejected() throws Exception {
    mvc.perform(
            anon(post("/api/v1/auth/register"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\": \"a@b.c\", \"password\": \"123\", \"displayName\": \"A\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errors[0].field").value("password"));
  }

  @Test
  void wrongPasswordAndUnknownEmailGiveSameError() throws Exception {
    String email = "login-" + UUID.randomUUID() + "@test.local";
    register(email).andExpect(status().isCreated());

    login(email, "sai-mat-khau")
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    login("khong-ton-tai@test.local", PASSWORD)
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    login(email.toUpperCase(), PASSWORD).andExpect(status().isOk());
  }

  // ---------- Bảo vệ API bằng JWT ----------

  @Test
  void apiRequiresValidToken() throws Exception {
    mvc.perform(get("/api/v1/places"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    mvc.perform(get("/api/v1/places").header(HttpHeaders.AUTHORIZATION, "Bearer rac.rac.rac"))
        .andExpect(status().isUnauthorized());

    UUID user = newUser();
    String expired = jwt.issue(users.findById(user).orElseThrow(), Instant.now().minus(Duration.ofHours(1)), Duration.ofMinutes(15));
    mvc.perform(get("/api/v1/places").header(HttpHeaders.AUTHORIZATION, "Bearer " + expired))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("TOKEN_EXPIRED"));

    mvc.perform(get("/api/v1/places").header(HttpHeaders.AUTHORIZATION, bearer(user)))
        .andExpect(status().isOk());
  }

  @Test
  void tokenSignedWithOtherKeyIsRejected() throws Exception {
    // Header + payload hợp lệ nhưng chữ ký giả
    String good = jwt.issueAccessToken(users.findById(newUser()).orElseThrow());
    String forged = good.substring(0, good.lastIndexOf('.') + 1) + "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    mvc.perform(get("/api/v1/places").header(HttpHeaders.AUTHORIZATION, "Bearer " + forged))
        .andExpect(status().isUnauthorized());
  }

  // ---------- Refresh token ----------

  @Test
  void refreshRotatesCookie() throws Exception {
    MvcResult r1 = register(uniqueEmail()).andReturn();
    String rt1 = refreshCookie(r1);

    MvcResult r2 = refresh(rt1).andExpect(status().isOk()).andReturn();
    String rt2 = refreshCookie(r2);
    assertThat(rt2).isNotBlank().isNotEqualTo(rt1);
    // Access token mới khác token cũ dù phát trong cùng một giây (claim jti)
    assertThat(body(r2).get("accessToken").asString()).isNotEqualTo(body(r1).get("accessToken").asString());

    refresh(rt2).andExpect(status().isOk());
  }

  @Test
  void reusingRotatedTokenRevokesWholeSession() throws Exception {
    String rt1 = refreshCookie(register(uniqueEmail()).andReturn());
    String rt2 = refreshCookie(refresh(rt1).andExpect(status().isOk()).andReturn());

    // Kẻ gian dùng lại rt1 (đã xoay) → bị chặn và thu hồi cả chuỗi
    MvcResult reuse = refresh(rt1).andExpect(status().isUnauthorized()).andReturn();
    assertThat(reuse.getResponse().getHeader(HttpHeaders.SET_COOKIE)).contains("Max-Age=0");

    // Chủ thật cầm rt2 cũng phải đăng nhập lại
    refresh(rt2).andExpect(status().isUnauthorized());
  }

  @Test
  void refreshWithoutOrGarbageCookieIs401() throws Exception {
    mvc.perform(post("/api/v1/auth/refresh")).andExpect(status().isUnauthorized());
    refresh("khong-hop-le").andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
  }

  /** Origin lạ bị CORS filter chặn (403) trước cả kiểm tra Origin trong AuthController. */
  @Test
  void refreshRejectsForeignOrigin() throws Exception {
    String rt = refreshCookie(register(uniqueEmail()).andReturn());
    mvc.perform(
            post("/api/v1/auth/refresh")
                .cookie(new Cookie("rt", rt))
                .header(HttpHeaders.ORIGIN, "https://evil.example"))
        .andExpect(status().isForbidden());
    // Cookie vẫn còn hiệu lực: request bị chặn không làm mất phiên của người dùng thật
    mvc.perform(
            post("/api/v1/auth/refresh")
                .cookie(new Cookie("rt", rt))
                .header(HttpHeaders.ORIGIN, "http://localhost:4200"))
        .andExpect(status().isOk());
  }

  @Test
  void logoutRevokesRefreshToken() throws Exception {
    String rt = refreshCookie(register(uniqueEmail()).andReturn());
    mvc.perform(post("/api/v1/auth/logout").cookie(new Cookie("rt", rt)))
        .andExpect(status().isNoContent())
        .andExpect(header().string(HttpHeaders.SET_COOKIE, org.hamcrest.Matchers.containsString("Max-Age=0")));
    refresh(rt).andExpect(status().isUnauthorized());
  }

  @Test
  void logoutAllRevokesEveryDevice() throws Exception {
    String email = uniqueEmail();
    MvcResult first = register(email).andReturn();
    String rtPhone = refreshCookie(first);
    String rtLaptop = refreshCookie(login(email, PASSWORD).andExpect(status().isOk()).andReturn());

    String token = body(first).get("accessToken").asString();
    mvc.perform(post("/api/v1/auth/logout-all").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
        .andExpect(status().isNoContent());

    refresh(rtPhone).andExpect(status().isUnauthorized());
    refresh(rtLaptop).andExpect(status().isUnauthorized());
  }

  // ---------- Rate limit ----------

  @Test
  void loginIsRateLimitedPerIp() throws Exception {
    for (int i = 0; i < 5; i++) {
      login("brute@test.local", "sai-" + i).andExpect(status().isUnauthorized());
    }
    login("brute@test.local", "sai-6")
        .andExpect(status().isTooManyRequests())
        .andExpect(header().exists(HttpHeaders.RETRY_AFTER))
        .andExpect(jsonPath("$.code").value("RATE_LIMITED"));

    // IP khác không bị ảnh hưởng
    mvc.perform(
            post("/api/v1/auth/login")
                .with(r -> {
                  r.setRemoteAddr("10.250.250.250");
                  return r;
                })
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\": \"brute@test.local\", \"password\": \"x\"}"))
        .andExpect(status().isUnauthorized());
  }

  // ---------- helpers ----------

  private ResultActions register(String email) throws Exception {
    return mvc.perform(
        anon(post("/api/v1/auth/register"))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\": \"%s\", \"password\": \"%s\", \"displayName\": \"Mai\"}".formatted(email, PASSWORD)));
  }

  private ResultActions login(String email, String password) throws Exception {
    return mvc.perform(
        anon(post("/api/v1/auth/login"))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\": \"%s\", \"password\": \"%s\"}".formatted(email, password)));
  }

  private ResultActions refresh(String rt) throws Exception {
    return mvc.perform(post("/api/v1/auth/refresh").cookie(new Cookie("rt", rt)));
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
    Matcher m = RT.matcher(header);
    assertThat(m.find()).isTrue();
    return m.group(1);
  }

  private static String uniqueEmail() {
    return "u-" + UUID.randomUUID() + "@test.local";
  }

  private static int rnd() {
    return 1 + (int) (Math.random() * 250);
  }
}
