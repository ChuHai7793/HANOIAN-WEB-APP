package com.gfmaster.dating;

import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.error.ErrorCode;
import com.gfmaster.dating.DatingDtos.Candidate;
import com.gfmaster.dating.DatingDtos.DatingSettings;
import com.gfmaster.dating.DatingDtos.DatingSettingsRequest;
import com.gfmaster.dating.DatingDtos.MatchView;
import com.gfmaster.dating.DatingDtos.MessageEvent;
import com.gfmaster.dating.DatingDtos.MessageView;
import com.gfmaster.dating.DatingDtos.ReadEvent;
import com.gfmaster.dating.DatingDtos.SuperLikeEvent;
import com.gfmaster.dating.DatingDtos.SwipeResult;
import com.gfmaster.dating.DatingDtos.TodayStats;
import com.gfmaster.dating.DatingDtos.UndoResult;
import com.gfmaster.dating.DatingDtos.UnmatchEvent;
import com.gfmaster.dating.DatingRepository.LastSwipe;
import com.gfmaster.dating.DatingRepository.MatchRow;
import com.gfmaster.profile.DatingInterest;
import com.gfmaster.profile.UserProfile;
import com.gfmaster.profile.UserProfileRepository;
import com.gfmaster.realtime.RealtimeEvents;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * "Tìm đối tượng": bật/tắt và bộ lọc, thẻ để quẹt, quẹt (hai bên cùng thích → match), hoàn tác lượt
 * gần nhất, danh sách match. Guest cũng dùng được (mỗi người một hồ sơ).
 */
@Service
@Transactional
public class DatingService {

  static final int MIN_AGE = 18;
  static final int DECK_SIZE = 10;
  /** Lấy rộng hơn số thẻ trả về để xếp lại theo hợp gu */
  static final int DECK_POOL = 60;

  private final UserProfileRepository profiles;
  private final DatingRepository dating;
  private final RealtimeEvents events;
  private final int superLikesPerDay;

  public DatingService(
      UserProfileRepository profiles,
      DatingRepository dating,
      RealtimeEvents events,
      @Value("${gfm.dating.super-likes-per-day:1}") int superLikesPerDay) {
    this.profiles = profiles;
    this.dating = dating;
    this.events = events;
    this.superLikesPerDay = superLikesPerDay;
  }

  @Transactional(readOnly = true)
  public DatingSettings settings(UUID me) {
    return toSettings(profiles.findById(me).orElse(null));
  }

  public DatingSettings saveSettings(UUID me, DatingSettingsRequest req) {
    if (req.enabled() && profiles.findById(me).map(UserProfile::isDatingBanned).orElse(false)) {
      throw new ApiException(ErrorCode.DATING_BANNED);
    }
    if (req.ageMin() > req.ageMax()) {
      throw new ApiException(ErrorCode.VALIDATION_FAILED, "Tuổi nhỏ nhất phải không lớn hơn tuổi lớn nhất.");
    }
    UserProfile p = profiles.findById(me).orElse(null);
    if (req.enabled() && !missing(p).isEmpty()) {
      throw new ApiException(ErrorCode.DATING_PROFILE_INCOMPLETE).with("missing", missing(p));
    }
    if (p == null) {
      // Chưa có hồ sơ thì chỉ lưu được khi tắt; không cần tạo dòng hồ sơ trống
      return toSettings(null);
    }
    p.setDatingEnabled(req.enabled());
    p.setInterestedIn(req.interestedIn());
    p.setAgeMin(req.ageMin());
    p.setAgeMax(req.ageMax());
    p.setSameCityOnly(req.sameCityOnly());
    return toSettings(profiles.saveAndFlush(p));
  }

  @Transactional(readOnly = true)
  public List<Candidate> deck(UUID me) {
    requireEnabled(me);
    return dating.deck(me, DECK_POOL, DECK_SIZE);
  }

  /** Trong ngày (giờ Việt Nam): số người đã thích, số lượt siêu thích còn lại. */
  @Transactional(readOnly = true)
  public TodayStats today(UUID me) {
    return new TodayStats(dating.likedToday(me), Math.max(0, superLikesPerDay - dating.superLikesToday(me)));
  }

  /**
   * Quẹt. {@code superLike}: siêu thích (phải đi cùng thích), mỗi ngày {@code gfm.dating.super-likes-per-day}
   * lượt; người nhận được báo realtime (không nêu tên) và thấy người này đầu tiên trên thẻ.
   */
  public SwipeResult swipe(UUID me, UUID target, boolean liked, boolean superLike) {
    requireEnabled(me);
    if (superLike && !liked) throw new ApiException(ErrorCode.VALIDATION_FAILED, "Siêu thích phải là thích.");
    if (me.equals(target) || !dating.isVisibleTo(me, target)) throw ApiException.notFound();
    if (superLike) {
      // Khoá hồ sơ của mình rồi mới đếm: hai lượt bấm đồng thời không vượt giới hạn
      dating.lockProfile(me);
      if (dating.superLikesToday(me) >= superLikesPerDay) throw new ApiException(ErrorCode.SUPER_LIKE_LIMIT);
    }
    if (!dating.insertSwipe(me, target, liked, superLike)) throw new ApiException(ErrorCode.ALREADY_SWIPED);
    boolean matched = liked && dating.liked(target, me);
    if (superLike && !matched) events.send(target, "super_like", new SuperLikeEvent());
    if (!matched) return new SwipeResult(false, null);
    MatchRow match = dating.upsertMatch(me, target);
    // Người kia thấy match mới ngay (mình thì nhận trong response)
    events.send(target, "match", new MatchView(match.id(), card(target, me), match.createdAt(), null, 0));
    return new SwipeResult(true, new MatchView(match.id(), card(me, target), match.createdAt(), null, 0));
  }

  /** Bỏ lượt quẹt gần nhất. Lượt thích đã tạo match thì không hoàn tác được. */
  public UndoResult undo(UUID me) {
    requireEnabled(me);
    LastSwipe last = dating.lastSwipe(me).orElseThrow(ApiException::notFound);
    if (last.liked() && dating.matched(me, last.targetId())) throw new ApiException(ErrorCode.CANNOT_UNDO_MATCH);
    dating.deleteSwipe(me, last.targetId());
    return new UndoResult(card(me, last.targetId()));
  }

  @Transactional(readOnly = true)
  public List<MatchView> matches(UUID me) {
    var rows = dating.matchesOf(me);
    // Thẻ của mọi người kia trong một lượt (quán cùng lưu tính cho cả danh sách)
    var cards =
        dating
            .forViewer(me, rows.stream().map(m -> dating.card(m.otherUserId()).orElseThrow(ApiException::notFound)).toList())
            .stream()
            .collect(Collectors.toMap(Candidate::userId, c -> c));
    return rows.stream()
        .map(m -> new MatchView(m.id(), cards.get(m.otherUserId()), m.createdAt(), m.lastMessage(), m.unread()))
        .toList();
  }

  // ---- Nhắn tin (chỉ hai người trong match; bỏ match / chặn thì cuộc trò chuyện mất theo) ----

  static final int MESSAGE_PAGE = 50;

  @Transactional(readOnly = true)
  public List<MessageView> messages(UUID me, UUID matchId, Instant after, Instant before) {
    requireParticipant(me, matchId);
    return dating.messages(matchId, me, after, before, MESSAGE_PAGE);
  }

  public MessageView send(UUID me, UUID matchId, String body) {
    UUID other = requireParticipant(me, matchId);
    if (profiles.findById(me).map(UserProfile::isDatingBanned).orElse(false)) {
      throw new ApiException(ErrorCode.DATING_BANNED);
    }
    MessageView sent = dating.insertMessage(matchId, me, body.strip());
    events.send(other, "message", new MessageEvent(matchId, sent.forOther()));
    // Các tab khác của chính mình
    events.send(me, "message", new MessageEvent(matchId, sent));
    return sent;
  }

  /** Mở cuộc trò chuyện: đánh dấu đã xem các tin người kia gửi. */
  public void markRead(UUID me, UUID matchId) {
    UUID other = requireParticipant(me, matchId);
    if (dating.markRead(matchId, me) > 0) events.send(other, "read", new ReadEvent(matchId, Instant.now()));
  }

  /**
   * Không phải người trong match (hoặc match không còn) → 404, không lộ match có tồn tại hay không.
   * Trả về người còn lại.
   */
  private UUID requireParticipant(UUID me, UUID matchId) {
    UUID[] pair = dating.participants(matchId).orElseThrow(ApiException::notFound);
    if (me.equals(pair[0])) return pair[1];
    if (me.equals(pair[1])) return pair[0];
    throw ApiException.notFound();
  }

  /** Bỏ match: hai người vẫn không hiện lại với nhau (lượt quẹt được giữ). */
  public void unmatch(UUID me, UUID matchId) {
    UUID other = requireParticipant(me, matchId);
    if (!dating.deleteMatch(me, matchId)) throw ApiException.notFound();
    events.send(other, "unmatch", new UnmatchEvent(matchId));
  }

  /** Chặn: không còn thấy nhau trên thẻ, match giữa hai người bị xoá. */
  public void block(UUID me, UUID other) {
    if (me.equals(other) || !dating.userExists(other)) throw ApiException.notFound();
    dating.block(me, other);
    for (UUID matchId : dating.deleteMatchBetween(me, other)) events.send(other, "unmatch", new UnmatchEvent(matchId));
  }

  /** Báo cáo gửi về admin; có thể chặn luôn. */
  public void report(UUID me, UUID other, ReportReason reason, String note, boolean alsoBlock) {
    if (me.equals(other) || !dating.userExists(other)) throw ApiException.notFound();
    dating.insertReport(me, other, reason.name(), note == null ? "" : note.trim());
    if (alsoBlock) block(me, other);
  }

  /** Thẻ của {@code userId} nhìn từ phía {@code viewer} (quán cùng lưu, hợp gu). */
  private Candidate card(UUID viewer, UUID userId) {
    return dating.forViewer(viewer, List.of(dating.card(userId).orElseThrow(ApiException::notFound))).getFirst();
  }

  private void requireEnabled(UUID me) {
    UserProfile p = profiles.findById(me).orElse(null);
    if (p != null && p.isDatingBanned()) throw new ApiException(ErrorCode.DATING_BANNED);
    if (p == null || !p.isDatingEnabled()) throw new ApiException(ErrorCode.DATING_NOT_ENABLED);
  }

  /** Những gì còn thiếu để bật "Tìm đối tượng". */
  static List<String> missing(UserProfile p) {
    List<String> out = new ArrayList<>();
    if (p == null || p.getAvatarUrl() == null) out.add("ảnh đại diện");
    LocalDate birthday = p == null ? null : p.getBirthday();
    if (birthday == null || Period.between(birthday, LocalDate.now()).getYears() < MIN_AGE) {
      out.add("ngày sinh (đủ 18 tuổi)");
    }
    return out;
  }

  private static DatingSettings toSettings(UserProfile p) {
    if (p == null) {
      return new DatingSettings(false, false, DatingInterest.all, MIN_AGE, 99, false, missing(null));
    }
    return new DatingSettings(
        p.isDatingEnabled(),
        p.isDatingBanned(),
        p.getInterestedIn(), p.getAgeMin(), p.getAgeMax(), p.isSameCityOnly(), missing(p));
  }
}
