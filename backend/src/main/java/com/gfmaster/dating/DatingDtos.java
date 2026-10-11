package com.gfmaster.dating;

import com.gfmaster.profile.DatingInterest;
import com.gfmaster.profile.Gender;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class DatingDtos {

  private DatingDtos() {}

  /**
   * Cài đặt "Tìm đối tượng" của chính mình. {@code missing}: những gì còn thiếu để bật được (rỗng =
   * bật được), ví dụ "ảnh đại diện", "ngày sinh (đủ 18 tuổi)".
   */
  public record DatingSettings(
      boolean enabled,
      /** Admin đã khoá khỏi mục này */
      boolean banned,
      DatingInterest interestedIn,
      int ageMin,
      int ageMax,
      boolean sameCityOnly,
      List<String> missing) {}

  public record DatingSettingsRequest(
      boolean enabled,
      @NotNull DatingInterest interestedIn,
      @Min(18) @Max(99) int ageMin,
      @Min(18) @Max(99) int ageMax,
      boolean sameCityOnly) {}

  /** Một thẻ hồ sơ để quẹt (hoặc người trong một match). */
  public record Candidate(
      UUID userId,
      String displayName,
      int age,
      Gender gender,
      String city,
      String bio,
      String avatarUrl,
      List<String> photos,
      List<String> interests) {}

  public record SwipeRequest(@NotNull UUID targetId, boolean liked) {}

  /**
   * Một match. {@code lastMessage}: tin nhắn gần nhất (null nếu chưa nhắn); {@code unread}: số tin người kia
   * gửi mà mình chưa xem.
   */
  public record MatchView(UUID id, Candidate user, Instant matchedAt, LastMessage lastMessage, int unread) {}

  public record LastMessage(String body, boolean mine, Instant at) {}

  /** Một tin nhắn. {@code mine}: do người đang xem gửi. {@code readAt}: người nhận đã xem lúc nào. */
  public record MessageView(UUID id, UUID senderId, boolean mine, String body, Instant createdAt, Instant readAt) {}

  public record SendMessageRequest(@NotBlank @Size(max = 2000) String body) {}

  /** {@code match}: có khi lượt thích này tạo match (hai bên cùng thích). */
  public record SwipeResult(boolean matched, MatchView match) {}

  /** Người vừa được hoàn tác, để giao diện đưa thẻ trở lại. */
  public record UndoResult(Candidate restored) {}

  public record BlockRequest(@NotNull UUID userId) {}

  /** {@code block}: báo cáo xong thì chặn luôn người này. */
  public record ReportRequest(
      @NotNull UUID userId, @NotNull ReportReason reason, @Size(max = 1000) String note, boolean block) {}
}
