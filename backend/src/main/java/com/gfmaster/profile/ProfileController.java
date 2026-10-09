package com.gfmaster.profile;

import com.gfmaster.common.security.CurrentUser;
import com.gfmaster.profile.ProfileDtos.AdminUserResponse;
import com.gfmaster.profile.ProfileDtos.ProfileRequest;
import com.gfmaster.profile.ProfileDtos.ProfileResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /me/profile}: hồ sơ của chính người đang đăng nhập ({@code @CurrentUser}, không phải
 * {@code @DataOwner}), nên guest cũng sửa được hồ sơ của mình (SecurityConfig mở {@code /me/**}).
 * {@code /admin/users}: chỉ ADMIN.
 */
@RestController
public class ProfileController {

  private final ProfileService service;

  public ProfileController(ProfileService service) {
    this.service = service;
  }

  @GetMapping("/api/v1/me/profile")
  public ProfileResponse get(@CurrentUser UUID userId) {
    return service.get(userId);
  }

  @PutMapping("/api/v1/me/profile")
  public ProfileResponse save(@CurrentUser UUID userId, @Valid @RequestBody ProfileRequest request) {
    return service.save(userId, request);
  }

  @GetMapping("/api/v1/admin/users")
  public List<AdminUserResponse> users() {
    return service.listForAdmin();
  }
}
