package com.gfmaster.auth;

import com.gfmaster.auth.dto.AuthDtos.AuthResponse;
import com.gfmaster.auth.dto.AuthDtos.LoginRequest;
import com.gfmaster.auth.dto.AuthDtos.RegisterRequest;
import com.gfmaster.auth.dto.AuthDtos.UserResponse;
import com.gfmaster.auth.social.SocialIdentity;
import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.error.ErrorCode;
import com.gfmaster.profile.ProfileService;
import com.gfmaster.user.Role;
import com.gfmaster.user.User;
import com.gfmaster.user.UserIdentity;
import com.gfmaster.user.UserIdentityRepository;
import com.gfmaster.user.UserRepository;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

  private static final Logger log = LoggerFactory.getLogger(AuthService.class);

  private final UserRepository users;
  private final UserIdentityRepository identities;
  private final PasswordEncoder passwordEncoder;
  private final JwtService jwt;
  private final RefreshTokenStore refreshTokens;
  private final ProfileService profiles;
  /** So mật khẩu với hash giả khi email không tồn tại, để thời gian phản hồi không lộ email nào có thật. */
  private final String dummyHash;

  public AuthService(
      UserRepository users,
      UserIdentityRepository identities,
      PasswordEncoder passwordEncoder,
      JwtService jwt,
      RefreshTokenStore refreshTokens,
      ProfileService profiles) {
    this.users = users;
    this.identities = identities;
    this.passwordEncoder = passwordEncoder;
    this.jwt = jwt;
    this.refreshTokens = refreshTokens;
    this.profiles = profiles;
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
    User user = newGuest(email, req.displayName().trim());
    user.setPasswordHash(passwordEncoder.encode(req.password()));
    // Hai request đăng ký cùng email song song: uk_users_email → 409 EMAIL_TAKEN
    users.saveAndFlush(user);
    return startSession(user, userAgent, true);
  }

  @Transactional(readOnly = true)
  public Session login(LoginRequest req, String userAgent) {
    String login = normalize(req.login());
    // Có "@" là email, không thì là tên đăng nhập (admin, guest...)
    Optional<User> user =
        login.contains("@") ? users.findByEmailIgnoreCase(login) : users.findByUsernameIgnoreCase(login);
    // Tài khoản chỉ có Google / Facebook (không mật khẩu): so với hash giả, cùng thông báo như sai mật khẩu
    String hash = user.map(User::getPasswordHash).orElse(dummyHash);
    boolean ok = passwordEncoder.matches(req.password(), hash == null ? dummyHash : hash);
    if (user.isEmpty() || user.get().getPasswordHash() == null || !ok) {
      throw new ApiException(ErrorCode.INVALID_CREDENTIALS);
    }
    return startSession(user.get(), userAgent, false);
  }

  /**
   * Đăng nhập bằng danh tính Google / Facebook đã được xác minh:
   *
   * <ol>
   *   <li>Đã liên kết (provider + subject) → đăng nhập user đó.
   *   <li>Chưa liên kết nhưng có tài khoản cùng email → liên kết rồi đăng nhập. Email lúc đăng ký thường chưa được
   *       xác minh, nên tài khoản tự đăng ký đang có mật khẩu bị <b>xoá mật khẩu và thu hồi mọi phiên</b>: nhà cung
   *       cấp đã xác minh người đang bấm nút là chủ email thật, mọi quyền bằng mật khẩu trước đó không đáng tin
   *       (chống chiếm tài khoản trước). Tài khoản có tên đăng nhập (admin, guest do hệ thống tạo) giữ mật khẩu.
   *   <li>Chưa có gì → tạo tài khoản mới không mật khẩu, kèm liên kết.
   * </ol>
   */
  @Transactional
  public Session loginWithSocial(SocialIdentity id, String userAgent) {
    Optional<UserIdentity> linked = identities.findByProviderAndSubject(id.provider(), id.subject());
    if (linked.isPresent()) {
      User user = users.findById(linked.get().getUserId()).orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
      return startSession(user, userAgent, false);
    }
    String email = normalize(id.email());
    Optional<User> existing = users.findByEmailIgnoreCase(email);
    if (existing.isPresent()) {
      User user = existing.get();
      if (user.getPasswordHash() != null && user.getUsername() == null) {
        log.info("Social login links {} to existing password account; password cleared and sessions revoked", id.provider());
        user.setPasswordHash(null);
        refreshTokens.revokeAll(user.getId());
      }
      link(user, id);
      return startSession(user, userAgent, false);
    }
    String name = id.name() == null || id.name().isBlank() ? email.substring(0, email.indexOf('@')) : id.name().trim();
    User user = newGuest(email, name.length() > 80 ? name.substring(0, 80) : name);
    users.saveAndFlush(user);
    link(user, id);
    if (id.pictureUrl() != null) profiles.setAvatarIfEmpty(user.getId(), id.pictureUrl());
    return startSession(user, userAgent, true);
  }

  private void link(User user, SocialIdentity id) {
    UserIdentity identity = new UserIdentity();
    identity.setUserId(user.getId());
    identity.setProvider(id.provider());
    identity.setSubject(id.subject());
    identity.setEmail(normalize(id.email()));
    identities.saveAndFlush(identity);
  }

  /**
   * Tài khoản tự đăng ký chỉ được xem: gắn vào dữ liệu của admin đầu tiên. Chưa có admin thì guest thấy danh sách
   * trống (dataOwnerId() = chính họ) nhưng vẫn không ghi được.
   */
  private User newGuest(String email, String displayName) {
    User user = new User();
    user.setEmail(email);
    user.setDisplayName(displayName);
    user.setRole(Role.GUEST);
    users.findFirstByRoleOrderByCreatedAtAsc(Role.ADMIN).ifPresent(admin -> user.setOwnerId(admin.getId()));
    return user;
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
    return new Session(body(user, false), rotation.token());
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
    return users.findById(userId).map(this::toUser).orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
  }

  private Session startSession(User user, String userAgent, boolean newUser) {
    return new Session(body(user, newUser), refreshTokens.issue(user.getId(), userAgent));
  }

  private AuthResponse body(User user, boolean newUser) {
    String token = jwt.issueAccessToken(user);
    return new AuthResponse(token, jwt.accessTtl().toSeconds(), toUser(user), newUser);
  }

  private UserResponse toUser(User u) {
    return new UserResponse(
        u.getId(), u.getEmail(), u.getUsername(), u.getDisplayName(), u.getRole(), profiles.avatarUrl(u.getId()));
  }

  private static String normalize(String email) {
    return email.trim().toLowerCase(Locale.ROOT);
  }
}
