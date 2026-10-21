package com.gfmaster.auth.social;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.queryParam;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withBadRequest;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.error.ErrorCode;
import com.gfmaster.config.GfmProperties;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

/** Graph API giả bằng MockRestServiceServer: debug_token rồi /me. */
class FacebookTokenVerifierTest {

  private static final String BASE = "https://graph.test/v21.0";

  private MockRestServiceServer server;
  private FacebookTokenVerifier verifier;

  private void setUp(String appId, String secret) {
    RestClient.Builder builder = RestClient.builder();
    server = MockRestServiceServer.bindTo(builder).build();
    GfmProperties props = Mockito.mock(GfmProperties.class);
    Mockito.when(props.social())
        .thenReturn(new GfmProperties.Social(new GfmProperties.Google("", "https://x", null), new GfmProperties.Facebook(appId, secret, BASE)));
    verifier = new FacebookTokenVerifier(props, builder);
  }

  @Test
  void validTokenYieldsIdentity() {
    setUp("123", "secret");
    server
        .expect(requestTo(org.hamcrest.Matchers.startsWith(BASE + "/debug_token")))
        .andExpect(queryParam("input_token", "tok"))
        .andExpect(queryParam("access_token", "123%7Csecret"))
        .andRespond(withSuccess("""
            {"data": {"app_id": "123", "is_valid": true, "user_id": "u9"}}
            """, MediaType.APPLICATION_JSON));
    server
        .expect(requestTo(org.hamcrest.Matchers.startsWith(BASE + "/me")))
        .andExpect(queryParam("access_token", "tok"))
        .andExpect(queryParam("appsecret_proof", org.hamcrest.Matchers.matchesRegex("[0-9a-f]{64}")))
        .andRespond(withSuccess("""
            {"id": "u9", "name": "Lan", "email": "lan@fb.test", "picture": {"data": {"url": "https://pic/1.jpg", "is_silhouette": false}}}
            """, MediaType.APPLICATION_JSON));

    SocialIdentity id = verifier.verify("tok");
    assertThat(id).isEqualTo(new SocialIdentity(SocialProvider.facebook, "u9", "lan@fb.test", "Lan", "https://pic/1.jpg"));
    server.verify();
  }

  @Test
  void rejectsTokenOfAnotherAppOrInvalid() {
    setUp("123", "secret");
    server.expect(requestTo(org.hamcrest.Matchers.startsWith(BASE + "/debug_token"))).andRespond(withSuccess("""
        {"data": {"app_id": "999", "is_valid": true, "user_id": "u9"}}
        """, MediaType.APPLICATION_JSON));
    assertRejected("tok", ErrorCode.SOCIAL_TOKEN_INVALID);

    setUp("123", "secret");
    server.expect(requestTo(org.hamcrest.Matchers.startsWith(BASE + "/debug_token"))).andRespond(withBadRequest());
    assertRejected("expired", ErrorCode.SOCIAL_TOKEN_INVALID);
  }

  @Test
  void rejectsWhenEmailNotShared() {
    setUp("123", "secret");
    server.expect(requestTo(org.hamcrest.Matchers.startsWith(BASE + "/debug_token"))).andRespond(withSuccess("""
        {"data": {"app_id": "123", "is_valid": true, "user_id": "u9"}}
        """, MediaType.APPLICATION_JSON));
    server.expect(requestTo(org.hamcrest.Matchers.startsWith(BASE + "/me"))).andRespond(withSuccess("""
        {"id": "u9", "name": "Lan"}
        """, MediaType.APPLICATION_JSON));
    assertRejected("tok", ErrorCode.SOCIAL_EMAIL_MISSING);
  }

  @Test
  void disabledWithoutAppCredentials() {
    setUp("", "");
    assertThat(verifier.enabled()).isFalse();
    assertRejected("tok", ErrorCode.SOCIAL_LOGIN_DISABLED);
  }

  private void assertRejected(String token, ErrorCode code) {
    assertThatThrownBy(() -> verifier.verify(token)).isInstanceOf(ApiException.class).extracting(e -> ((ApiException) e).code()).isEqualTo(code);
    assertThat(List.of(code)).isNotEmpty();
  }
}
