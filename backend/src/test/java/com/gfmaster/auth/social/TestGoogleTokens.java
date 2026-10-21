package com.gfmaster.auth.social;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Ký ID token "giả Google" bằng khoá RSA của test ({@code src/test/resources/keys}). Khoá công khai tương ứng nằm
 * trong application-test.yml ({@code gfm.social.google.public-key-pem}) để backend kiểm tra chữ ký như với Google.
 */
public final class TestGoogleTokens {

  public static final String CLIENT_ID = "test-google-client-id";

  private TestGoogleTokens() {}

  public static PrivateKey privateKey() {
    try {
      String pem = read("/keys/google-test-private.pem").replaceAll("-----[A-Z ]+-----", "").replaceAll("\\s", "");
      return KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(Base64.getDecoder().decode(pem)));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  public static RSAPublicKey publicKey() {
    return GoogleTokenVerifier.parsePublicKey(read("/keys/google-test-public.pem"));
  }

  /** Token hợp lệ cho {@code sub} / {@code email}, email đã xác minh, còn hạn 1 giờ. */
  public static String token(String sub, String email, String name) {
    return token(Map.of("sub", sub, "email", email, "email_verified", true, "name", name, "picture", "https://lh3.googleusercontent.com/a/" + sub));
  }

  public static String newUserToken(String name) {
    String sub = "g-" + UUID.randomUUID();
    return token(sub, sub + "@gmail.test", name);
  }

  /** Token với các claim tuỳ chỉnh; thiếu iss / aud / exp thì dùng giá trị hợp lệ. Ký bằng khoá của test. */
  public static String token(Map<String, Object> claims) {
    return token(claims, privateKey());
  }

  public static String token(Map<String, Object> claims, PrivateKey key) {
    try {
      JWTClaimsSet.Builder b =
          new JWTClaimsSet.Builder()
              .issuer("https://accounts.google.com")
              .audience(List.of(CLIENT_ID))
              .issueTime(Date.from(Instant.now().minusSeconds(5)))
              .expirationTime(Date.from(Instant.now().plusSeconds(3600)));
      claims.forEach(
          (k, v) -> {
            switch (k) {
              case "iss" -> b.issuer((String) v);
              case "aud" -> b.audience((String) v);
              case "exp" -> b.expirationTime((Date) v);
              default -> b.claim(k, v);
            }
          });
      SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID("test").build(), b.build());
      jwt.sign(new RSASSASigner(key));
      return jwt.serialize();
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  private static String read(String resource) {
    try (InputStream in = TestGoogleTokens.class.getResourceAsStream(resource)) {
      if (in == null) throw new IllegalStateException("Thiếu " + resource);
      return new String(in.readAllBytes(), StandardCharsets.UTF_8);
    } catch (IOException e) {
      throw new IllegalStateException(e);
    }
  }
}
