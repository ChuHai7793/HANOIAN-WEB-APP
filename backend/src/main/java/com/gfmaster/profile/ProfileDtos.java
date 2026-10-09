package com.gfmaster.profile;

import com.gfmaster.place.dto.PlaceRequest;
import com.gfmaster.user.Role;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public final class ProfileDtos {

  private ProfileDtos() {}

  /**
   * Lưu toàn bộ hồ sơ (PUT): trường để trống hoặc null là xoá giá trị đó. {@code version}: null khi
   * lưu lần đầu, sau đó phải gửi lại version đã đọc để chống ghi đè (409 VERSION_CONFLICT).
   */
  public record ProfileRequest(
      @NotBlank @Size(max = 80) String displayName,
      @Size(max = 1024) @Pattern(regexp = PlaceRequest.IMAGE_URL, message = "Chỉ nhận URL http(s) hoặc /uploads/")
          String avatarUrl,
      @Past(message = "Ngày sinh phải ở quá khứ") LocalDate birthday,
      Gender gender,
      @Pattern(regexp = "^$|^[0-9]{9,11}$", message = "Số điện thoại 9–11 chữ số") String phone,
      @Size(max = 80) String city,
      @Size(max = 500) String bio,
      Long version) {}

  /** {@code version == null}: chưa lưu hồ sơ lần nào. avatarUrl đã là URL công khai. */
  public record ProfileResponse(
      String displayName,
      String avatarUrl,
      LocalDate birthday,
      Gender gender,
      String phone,
      String city,
      String bio,
      Instant completedAt,
      Long version) {}

  /** Danh sách người dùng cho admin. {@code profile.version == null}: người đó chưa nhập hồ sơ. */
  public record AdminUserResponse(
      UUID id, String email, String username, Role role, Instant createdAt, ProfileResponse profile) {}
}
