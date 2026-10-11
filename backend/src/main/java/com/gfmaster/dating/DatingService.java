package com.gfmaster.dating;

import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.error.ErrorCode;
import com.gfmaster.dating.DatingDtos.Candidate;
import com.gfmaster.dating.DatingDtos.DatingSettings;
import com.gfmaster.dating.DatingDtos.DatingSettingsRequest;
import com.gfmaster.dating.DatingDtos.MatchView;
import com.gfmaster.dating.DatingDtos.SwipeResult;
import com.gfmaster.dating.DatingDtos.UndoResult;
import com.gfmaster.dating.DatingRepository.LastSwipe;
import com.gfmaster.dating.DatingRepository.MatchRow;
import com.gfmaster.profile.DatingInterest;
import com.gfmaster.profile.UserProfile;
import com.gfmaster.profile.UserProfileRepository;
import java.time.LocalDate;
import java.time.Period;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
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

  private final UserProfileRepository profiles;
  private final DatingRepository dating;

  public DatingService(UserProfileRepository profiles, DatingRepository dating) {
    this.profiles = profiles;
    this.dating = dating;
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
    return dating.deck(me, DECK_SIZE);
  }

  public SwipeResult swipe(UUID me, UUID target, boolean liked) {
    requireEnabled(me);
    if (me.equals(target) || !dating.isVisibleTo(me, target)) throw ApiException.notFound();
    if (!dating.insertSwipe(me, target, liked)) throw new ApiException(ErrorCode.ALREADY_SWIPED);
    if (!liked || !dating.liked(target, me)) return new SwipeResult(false, null);
    MatchRow match = dating.upsertMatch(me, target);
    return new SwipeResult(true, new MatchView(match.id(), card(target), match.createdAt()));
  }

  /** Bỏ lượt quẹt gần nhất. Lượt thích đã tạo match thì không hoàn tác được. */
  public UndoResult undo(UUID me) {
    requireEnabled(me);
    LastSwipe last = dating.lastSwipe(me).orElseThrow(ApiException::notFound);
    if (last.liked() && dating.matched(me, last.targetId())) throw new ApiException(ErrorCode.CANNOT_UNDO_MATCH);
    dating.deleteSwipe(me, last.targetId());
    return new UndoResult(card(last.targetId()));
  }

  @Transactional(readOnly = true)
  public List<MatchView> matches(UUID me) {
    return dating.matchesOf(me).stream()
        .map(m -> new MatchView(m.id(), card(m.otherUserId()), m.createdAt()))
        .toList();
  }

  /** Bỏ match: hai người vẫn không hiện lại với nhau (lượt quẹt được giữ). */
  public void unmatch(UUID me, UUID matchId) {
    if (!dating.deleteMatch(me, matchId)) throw ApiException.notFound();
  }

  /** Chặn: không còn thấy nhau trên thẻ, match giữa hai người bị xoá. */
  public void block(UUID me, UUID other) {
    if (me.equals(other) || !dating.userExists(other)) throw ApiException.notFound();
    dating.block(me, other);
    dating.deleteMatchBetween(me, other);
  }

  /** Báo cáo gửi về admin; có thể chặn luôn. */
  public void report(UUID me, UUID other, ReportReason reason, String note, boolean alsoBlock) {
    if (me.equals(other) || !dating.userExists(other)) throw ApiException.notFound();
    dating.insertReport(me, other, reason.name(), note == null ? "" : note.trim());
    if (alsoBlock) block(me, other);
  }

  private Candidate card(UUID userId) {
    return dating.card(userId).orElseThrow(ApiException::notFound);
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
