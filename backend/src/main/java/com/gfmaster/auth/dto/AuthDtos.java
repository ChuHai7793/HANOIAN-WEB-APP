package com.gfmaster.auth.dto;

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

  public record LoginRequest(@NotBlank String email, @NotBlank String password) {}

  public record UserResponse(UUID id, String email, String displayName) {}

  /** Refresh token không nằm trong body mà trong cookie httpOnly {@code rt}. */
  public record AuthResponse(String accessToken, long expiresIn, UserResponse user) {}
}
