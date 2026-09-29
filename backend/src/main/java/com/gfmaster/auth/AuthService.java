package com.gfmaster.auth;

import com.gfmaster.auth.dto.AuthDtos.AuthResponse;
import com.gfmaster.auth.dto.AuthDtos.LoginRequest;
import com.gfmaster.auth.dto.AuthDtos.RegisterRequest;
import com.gfmaster.auth.dto.AuthDtos.UserResponse;
import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.error.ErrorCode;
import com.gfmaster.user.Role;
import com.gfmaster.user.User;
import com.gfmaster.user.UserRepository;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

  private final UserRepository users;
  private final PasswordEncoder passwordEncoder;
  private final JwtService jwt;
  private final RefreshTokenStore refreshTokens;
  /** So mật khẩu với hash giả khi email không tồn tại, để thời gian phản hồi không lộ email nào có thật. */
  private final String dummyHash;

  public AuthService(
      UserRepository users, PasswordEncoder passwordEncoder, JwtService jwt, RefreshTokenStore refreshTokens) {
    this.users = users;
    this.passwordEncoder = passwordEncoder;
    this.jwt = jwt;
    this.refreshTokens = refreshTokens;
    this.dummyHash = passwordEncoder.encode(UUID.randomUUID().toString());
  }

  /** Kết quả đăng nhập: body trả cho client + refresh token để đặt vào cookie. */
  public record Session(AuthResponse body, String refreshToken) {}

  @Transactional
  public Session register(RegisterRequest req, String userAgent) {
    String email = normalize(req.email());
    if (users.existsByEmailIgnoreCase(email)) {
      throw new ApiException(ErrorCode.EMAIL_TAKEN);
    }
    User user = new User();
    user.setEmail(email);
    user.setPasswordHash(passwordEncoder.encode(req.password()));
    user.setDisplayName(req.displayName().trim());
    // Tài khoản tự đăng ký chỉ được xem: gắn vào dữ liệu của admin đầu tiên. Chưa có admin thì
    // guest thấy danh sách trống (dataOwnerId() = chính họ) nhưng vẫn không ghi được.
    user.setRole(Role.GUEST);
    users.findFirstByRoleOrderByCreatedAtAsc(Role.ADMIN).ifPresent(admin -> user.setOwnerId(admin.getId()));
    // Hai request đăng ký cùng email song song: uk_users_email → 409 EMAIL_TAKEN
    users.saveAndFlush(user);
    return startSession(user, userAgent);
  }

  @Transactional(readOnly = true)
  public Session login(LoginRequest req, String userAgent) {
    String login = normalize(req.login());
    // Có "@" là email, không thì là tên đăng nhập (admin, guest...)
    Optional<User> user =
        login.contains("@") ? users.findByEmailIgnoreCase(login) : users.findByUsernameIgnoreCase(login);
    String hash = user.map(User::getPasswordHash).orElse(dummyHash);
    boolean ok = passwordEncoder.matches(req.password(), hash);
    if (user.isEmpty() || !ok) {
      throw new ApiException(ErrorCode.INVALID_CREDENTIALS);
    }
    return startSession(user.get(), userAgent);
  }

  @Transactional(readOnly = true)
  public Session refresh(String refreshToken, String userAgent) {
    if (refreshToken == null || refreshToken.isBlank()) {
      throw new ApiException(ErrorCode.UNAUTHORIZED);
    }
    RefreshTokenStore.Rotation rotation = refreshTokens.rotate(refreshToken, userAgent);
    User user =
        users
            .findById(rotation.userId())
            .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
    return new Session(body(user), rotation.token());
  }

  public void logout(String refreshToken) {
    if (refreshToken != null && !refreshToken.isBlank()) {
      refreshTokens.revoke(refreshToken);
    }
  }

  public void logoutAll(UUID userId) {
    refreshTokens.revokeAll(userId);
  }

  @Transactional(readOnly = true)
  public UserResponse me(UUID userId) {
    return users.findById(userId).map(AuthService::toUser).orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
  }

  private Session startSession(User user, String userAgent) {
    return new Session(body(user), refreshTokens.issue(user.getId(), userAgent));
  }

  private AuthResponse body(User user) {
    String token = jwt.issueAccessToken(user);
    return new AuthResponse(token, jwt.accessTtl().toSeconds(), toUser(user));
  }

  private static UserResponse toUser(User u) {
    return new UserResponse(u.getId(), u.getEmail(), u.getUsername(), u.getDisplayName(), u.getRole());
  }

  private static String normalize(String email) {
    return email.trim().toLowerCase(Locale.ROOT);
  }
}
