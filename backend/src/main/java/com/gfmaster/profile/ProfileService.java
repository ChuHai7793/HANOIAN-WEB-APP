package com.gfmaster.profile;

import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.error.ErrorCode;
import com.gfmaster.profile.ProfileDtos.AdminUserResponse;
import com.gfmaster.profile.ProfileDtos.ProfileRequest;
import com.gfmaster.profile.ProfileDtos.ProfileResponse;
import com.gfmaster.upload.storage.ImageUrls;
import com.gfmaster.user.User;
import com.gfmaster.user.UserRepository;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Hồ sơ cá nhân: mỗi người chỉ đọc/sửa hồ sơ của chính mình; admin xem được hồ sơ của mọi người. */
@Service
public class ProfileService {

  private final UserProfileRepository profiles;
  private final UserRepository users;
  private final ImageUrls imageUrls;

  public ProfileService(UserProfileRepository profiles, UserRepository users, ImageUrls imageUrls) {
    this.profiles = profiles;
    this.users = users;
    this.imageUrls = imageUrls;
  }

  @Transactional(readOnly = true)
  public ProfileResponse get(UUID userId) {
    User user = loadUser(userId);
    return toResponse(user, profiles.findById(userId).orElse(null));
  }

  @Transactional
  public ProfileResponse save(UUID userId, ProfileRequest req) {
    User user = loadUser(userId);
    UserProfile profile = profiles.findById(userId).orElse(null);
    if (!Objects.equals(profile == null ? null : profile.getVersion(), req.version())) {
      throw new ApiException(ErrorCode.VERSION_CONFLICT).with("current", toResponse(user, profile));
    }
    if (profile == null) {
      profile = new UserProfile();
      profile.setUserId(userId);
    }
    user.setDisplayName(req.displayName().trim());
    profile.setAvatarUrl(blankToNull(imageUrls.toStored(req.avatarUrl())));
    profile.setBirthday(req.birthday());
    profile.setGender(req.gender());
    profile.setPhone(blankToNull(req.phone()));
    profile.setCity(blankToNull(req.city()));
    profile.setBio(req.bio() == null ? "" : req.bio().trim());
    if (profile.getCompletedAt() == null) profile.setCompletedAt(Instant.now());
    UserProfile saved = profiles.saveAndFlush(profile);
    return toResponse(user, saved);
  }

  /** Ảnh đại diện (URL công khai) để hiện ở thanh menu; null nếu chưa có. */
  @Transactional(readOnly = true)
  public String avatarUrl(UUID userId) {
    return profiles.findById(userId).map(p -> imageUrls.toPublic(p.getAvatarUrl())).orElse(null);
  }

  @Transactional(readOnly = true)
  public List<AdminUserResponse> listForAdmin() {
    Map<UUID, UserProfile> byUser =
        profiles.findAll().stream().collect(Collectors.toMap(UserProfile::getUserId, Function.identity()));
    return users.findAll(Sort.by(Sort.Direction.DESC, "createdAt")).stream()
        .map(
            u ->
                new AdminUserResponse(
                    u.getId(),
                    u.getEmail(),
                    u.getUsername(),
                    u.getRole(),
                    u.getCreatedAt(),
                    toResponse(u, byUser.get(u.getId()))))
        .toList();
  }

  private User loadUser(UUID userId) {
    return users.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED));
  }

  private ProfileResponse toResponse(User user, UserProfile p) {
    if (p == null) {
      return new ProfileResponse(user.getDisplayName(), null, null, null, null, null, "", null, null);
    }
    return new ProfileResponse(
        user.getDisplayName(),
        imageUrls.toPublic(p.getAvatarUrl()),
        p.getBirthday(),
        p.getGender(),
        p.getPhone(),
        p.getCity(),
        p.getBio(),
        p.getCompletedAt(),
        p.getVersion());
  }

  private static String blankToNull(String s) {
    return s == null || s.isBlank() ? null : s.trim();
  }
}
