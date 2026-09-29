package com.gfmaster.auth;

import com.gfmaster.config.GfmProperties;
import com.gfmaster.config.JwtConfig;
import com.gfmaster.user.User;
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

  public static final String ROLE_CLAIM = "role";
  public static final String DATA_OWNER_CLAIM = "own";

  private final JwtEncoder encoder;
  private final Duration accessTtl;

  public JwtService(JwtEncoder encoder, GfmProperties props) {
    this.encoder = encoder;
    this.accessTtl = props.jwt().accessTtl();
  }

  public Duration accessTtl() {
    return accessTtl;
  }

  public String issueAccessToken(User user) {
    return issue(user, Instant.now(), accessTtl);
  }

  /**
   * Claim ngoài chuẩn: {@code email}, {@code role} (ADMIN/GUEST, Spring Security đổi thành
   * ROLE_ADMIN/ROLE_GUEST) và {@code own} (chủ dữ liệu: chính user, hoặc admin nếu là guest).
   * Cho phép chỉ định thời điểm phát và TTL (test dùng để tạo token đã hết hạn).
   */
  public String issue(User user, Instant issuedAt, Duration ttl) {
    JwtClaimsSet claims =
        JwtClaimsSet.builder()
            .id(UUID.randomUUID().toString()) // jti: mỗi token là duy nhất kể cả khi phát cùng một giây
            .issuer(JwtConfig.ISSUER)
            .subject(user.getId().toString())
            .claim("email", user.getEmail())
            .claim(ROLE_CLAIM, user.getRole().name())
            .claim(DATA_OWNER_CLAIM, user.dataOwnerId().toString())
            .issuedAt(issuedAt)
            .expiresAt(issuedAt.plus(ttl))
            .build();
    JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
    return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
  }
}
