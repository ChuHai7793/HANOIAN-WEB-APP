package com.gfmaster.auth.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.gfmaster.user.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/** DTO của /api/v1/auth. */
public final class AuthDtos {

  private AuthDtos() {}

  /** Mật khẩu tối đa 72 byte vì BCrypt bỏ qua phần sau. */
  public record RegisterRequest(
      @NotBlank @Email @Size(max = 255) String email,
      @NotBlank @Size(min = 8, max = 72, message = "Mật khẩu phải từ 8 đến 72 ký tự") String password,
      @NotBlank @Size(max = 80) String displayName) {}

  /** {@code login}: email hoặc tên đăng nhập. Nhận cả field cũ {@code email} để client cũ vẫn chạy. */
  public record LoginRequest(@NotBlank @JsonAlias("email") String login, @NotBlank String password) {}

  /** {@code role}: ADMIN (thêm/sửa/xoá được) hoặc GUEST (chỉ xem). */
  /** {@code avatarUrl}: ảnh đại diện trong hồ sơ (URL công khai), null nếu chưa có. */
  public record UserResponse(
      UUID id, String email, String username, String displayName, Role role, String avatarUrl) {}

  /** Refresh token không nằm trong body mà trong cookie httpOnly {@code rt}. */
  public record AuthResponse(String accessToken, long expiresIn, UserResponse user) {}
}
