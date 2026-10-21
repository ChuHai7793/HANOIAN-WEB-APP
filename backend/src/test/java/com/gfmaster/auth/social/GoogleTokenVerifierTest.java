package com.gfmaster.auth.social;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.error.ErrorCode;
import java.security.KeyPairGenerator;
import java.time.Instant;
import java.util.Date;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

/** Kiểm tra ID token Google với khoá RSA của test: chữ ký, iss, aud, exp, email_verified. */
class GoogleTokenVerifierTest {

  private final GoogleTokenVerifier verifier = verifier(TestGoogleTokens.CLIENT_ID);

  private static GoogleTokenVerifier verifier(String clientId) {
    NimbusJwtDecoder decoder = GoogleTokenVerifier.configure(NimbusJwtDecoder.withPublicKey(TestGoogleTokens.publicKey()).build(), clientId);
    return new GoogleTokenVerifier(clientId, decoder);
  }

  @Test
  void validTokenYieldsIdentity() {
    SocialIdentity id = verifier.verify(TestGoogleTokens.token("sub-1", "Mai@Gmail.test", "Mai"));
    assertThat(id.provider()).isEqualTo(SocialProvider.google);
    assertThat(id.subject()).isEqualTo("sub-1");
    assertThat(id.email()).isEqualTo("Mai@Gmail.test");
    assertThat(id.name()).isEqualTo("Mai");
    assertThat(id.pictureUrl()).startsWith("https://");
  }

  @Test
  void acceptsBothGoogleIssuers() {
    assertThat(verifier.verify(TestGoogleTokens.token(Map.of("iss", "accounts.google.com", "sub", "s", "email", "a@b.c", "email_verified", true))).subject())
        .isEqualTo("s");
  }

  @Test
  void rejectsWrongSignature() throws Exception {
    var other = KeyPairGenerator.getInstance("RSA");
    other.initialize(2048);
    String forged = TestGoogleTokens.token(Map.of("sub", "s", "email", "a@b.c", "email_verified", true), other.generateKeyPair().getPrivate());
    assertRejected(forged, ErrorCode.SOCIAL_TOKEN_INVALID);
  }

  @Test
  void rejectsOtherAudienceIssuerAndExpired() {
    assertRejected(TestGoogleTokens.token(Map.of("aud", "other-app", "sub", "s", "email", "a@b.c", "email_verified", true)), ErrorCode.SOCIAL_TOKEN_INVALID);
    assertRejected(TestGoogleTokens.token(Map.of("iss", "https://evil.example", "sub", "s", "email", "a@b.c", "email_verified", true)), ErrorCode.SOCIAL_TOKEN_INVALID);
    assertRejected(
        TestGoogleTokens.token(Map.of("exp", Date.from(Instant.now().minusSeconds(600)), "sub", "s", "email", "a@b.c", "email_verified", true)),
        ErrorCode.SOCIAL_TOKEN_INVALID);
    assertRejected("not-a-jwt", ErrorCode.SOCIAL_TOKEN_INVALID);
    assertRejected("", ErrorCode.SOCIAL_TOKEN_INVALID);
  }

  @Test
  void rejectsUnverifiedOrMissingEmail() {
    assertRejected(TestGoogleTokens.token(Map.of("sub", "s", "email", "a@b.c", "email_verified", false)), ErrorCode.SOCIAL_EMAIL_MISSING);
    assertRejected(TestGoogleTokens.token(Map.of("sub", "s")), ErrorCode.SOCIAL_EMAIL_MISSING);
  }

  @Test
  void disabledWhenNoClientId() {
    assertThat(verifier("").enabled()).isFalse();
    assertRejected(verifier(""), TestGoogleTokens.token("s", "a@b.c", "A"), ErrorCode.SOCIAL_LOGIN_DISABLED);
  }

  private void assertRejected(String token, ErrorCode code) {
    assertRejected(verifier, token, code);
  }

  private static void assertRejected(GoogleTokenVerifier v, String token, ErrorCode code) {
    assertThatThrownBy(() -> v.verify(token)).isInstanceOf(ApiException.class).extracting(e -> ((ApiException) e).code()).isEqualTo(code);
  }
}
