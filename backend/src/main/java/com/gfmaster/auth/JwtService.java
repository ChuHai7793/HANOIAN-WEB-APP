package com.gfmaster.auth;

import com.gfmaster.config.GfmProperties;
import com.gfmaster.config.JwtConfig;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

/** Phát access token: {@code sub} = userId, claim {@code email}, sống {@code gfm.jwt.access-ttl}. */
@Service
public class JwtService {

  private final JwtEncoder encoder;
  private final Duration accessTtl;

  public JwtService(JwtEncoder encoder, GfmProperties props) {
    this.encoder = encoder;
    this.accessTtl = props.jwt().accessTtl();
  }

  public Duration accessTtl() {
    return accessTtl;
  }

  public String issueAccessToken(UUID userId, String email) {
    return issue(userId, email, Instant.now(), accessTtl);
  }

  /** Cho phép chỉ định thời điểm phát và TTL (test dùng để tạo token đã hết hạn). */
  public String issue(UUID userId, String email, Instant issuedAt, Duration ttl) {
    JwtClaimsSet claims =
        JwtClaimsSet.builder()
            .id(UUID.randomUUID().toString()) // jti: mỗi token là duy nhất kể cả khi phát cùng một giây
            .issuer(JwtConfig.ISSUER)
            .subject(userId.toString())
            .claim("email", email)
            .issuedAt(issuedAt)
            .expiresAt(issuedAt.plus(ttl))
            .build();
    JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
    return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
  }
}
