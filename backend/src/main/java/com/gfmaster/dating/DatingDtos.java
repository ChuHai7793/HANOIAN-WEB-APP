package com.gfmaster.dating;

import com.gfmaster.profile.DatingInterest;
import com.gfmaster.place.PlaceType;
import com.gfmaster.place.PriceRange;
import com.gfmaster.profile.Gender;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
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

  /**
   * Một thẻ hồ sơ để quẹt (hoặc người trong một match), nhìn từ phía người đang xem.
   * {@code sharedPlaces}: quán cả hai cùng lưu trong My place (chỉ phần giao nhau, không lộ quán chỉ người kia
   * lưu); {@code fit}: % hợp gu tính từ số quán cùng lưu (0 = chưa có quán chung); {@code superLikedMe}: người
   * này đã siêu thích người đang xem.
   */
  public record Candidate(
      UUID userId,
      String displayName,
      int age,
      Gender gender,
      String city,
      String bio,
      String avatarUrl,
      List<String> photos,
      List<String> interests,
      List<SharedPlace> sharedPlaces,
      int fit,
      boolean superLikedMe) {}

  /** Quán cùng lưu: {@code district} là tên quận để hiển thị. */
  public record SharedPlace(UUID catalogId, String name, PlaceType type, String district, PriceRange priceRange) {}

  /** {@code superLike}: siêu thích (giới hạn lượt mỗi ngày), chỉ đi cùng {@code liked = true}. */
  public record SwipeRequest(@NotNull UUID targetId, boolean liked, Boolean superLike) {}

  /** Trong ngày (giờ Việt Nam): số người đã thích, số lượt siêu thích còn lại. */
  public record TodayStats(int liked, int superLikesLeft) {}

  /** Báo người nhận có người vừa siêu thích họ (không nêu tên, vẫn phải quẹt để biết). */
  public record SuperLikeEvent() {}

  /**
   * Một match. {@code lastMessage}: tin nhắn gần nhất (null nếu chưa nhắn); {@code unread}: số tin người kia
   * gửi mà mình chưa xem.
   */
  public record MatchView(UUID id, Candidate user, Instant matchedAt, LastMessage lastMessage, int unread) {}

  public record LastMessage(String body, boolean mine, Instant at) {}

  /** Một tin nhắn. {@code mine}: do người đang xem gửi. {@code readAt}: người nhận đã xem lúc nào. */
  /** {@code plan}: tin "Rủ đi" kèm một plan (null với tin thường, hoặc khi plan đã bị xoá). */
  public record MessageView(
      UUID id, UUID senderId, boolean mine, String body, Instant createdAt, Instant readAt, PlanRef plan) {
    /** Cùng tin, nhìn từ phía người kia. */
    public MessageView forOther() {
      return new MessageView(id, senderId, !mine, body, createdAt, readAt, plan);
    }
  }

  /** Plan đính kèm trong tin nhắn. */
  public record PlanRef(UUID id, String title, LocalDate date, int stopCount) {}

  // ---- Sự kiện realtime (SSE): message, read, match, unmatch ----

  /** Tin mới trong một match ({@code message.mine} tính theo người nhận sự kiện). */
  public record MessageEvent(UUID matchId, MessageView message) {}

  /** Người kia đã xem các tin mình gửi trong match. */
  public record ReadEvent(UUID matchId, Instant readAt) {}

  /** Match không còn (người kia bỏ match hoặc chặn). */
  public record UnmatchEvent(UUID matchId) {}

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
