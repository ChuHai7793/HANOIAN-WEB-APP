package com.gfmaster.dating;

import com.gfmaster.common.error.ApiException;
import com.gfmaster.upload.storage.ImageUrls;
import jakarta.validation.constraints.NotNull;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Quản trị người dùng (trang "Người dùng" của admin; chỉ ADMIN, SecurityConfig chặn {@code /api/v1/admin/**}).
 * Admin có toàn quyền: thống kê, mọi tài khoản và trạng thái Tìm đối tượng của họ, báo cáo, xem ai thích ai và
 * các match của từng người, khoá/mở khoá khỏi Tìm đối tượng. Chỉ đọc/ghi vài bảng nhỏ nên truy vấn thẳng bằng
 * SQL ngay tại đây.
 */
@RestController
@RequestMapping("/api/v1/admin/dating")
@Transactional
public class DatingAdminController {

  private final NamedParameterJdbcTemplate jdbc;
  private final ImageUrls imageUrls;
  private final DatingRepository dating;

  public DatingAdminController(NamedParameterJdbcTemplate jdbc, ImageUrls imageUrls, DatingRepository dating) {
    this.jdbc = jdbc;
    this.imageUrls = imageUrls;
    this.dating = dating;
  }

  /** Ảnh dạng lưu (/uploads/...) → URL công khai (local hoặc CDN). */
  private Person person(ResultSet rs, String prefix) throws SQLException {
    return new Person(
        rs.getObject(prefix + "id", UUID.class),
        rs.getString(prefix + "display_name"),
        rs.getString(prefix + "email"),
        imageUrls.toPublic(rs.getString(prefix + "avatar_url")));
  }

  public record Stats(
      long totalUsers,
      long noProfile,
      long incompleteProfiles,
      long enabledUsers,
      long bannedUsers,
      long swipes,
      long likes,
      long matches,
      long openReports) {}

  /**
   * Trạng thái Tìm đối tượng của một tài khoản: chưa có dòng hồ sơ, hồ sơ thiếu (ảnh / ngày sinh đủ 18 tuổi,
   * cùng điều kiện với {@link DatingService}), đủ nhưng chưa bật, đang bật, bị khoá.
   */
  public enum DatingStatus {
    NO_PROFILE,
    INCOMPLETE,
    OFF,
    ON,
    BANNED
  }

  public record Person(UUID id, String displayName, String email, String avatarUrl) {}

  public record ReportView(
      UUID id, Person reporter, Person reported, ReportReason reason, String note, String status, Instant createdAt) {}

  public record UserRow(
      Person user,
      String username,
      String role,
      Instant createdAt,
      String city,
      DatingStatus status,
      boolean enabled,
      boolean banned,
      long likesGiven,
      long likesReceived,
      long matches,
      long reportsAgainst) {}

  /** Hồ sơ đầy đủ và mức dùng app, cho trang chi tiết một người */
  public record UserDetail(
      String gender,
      LocalDate birthday,
      String phone,
      String bio,
      List<String> missing,
      long savedPlaces,
      long savedSpots,
      long plans) {}

  /** {@code matchId}: chỉ có ở danh sách match (để admin mở cuộc trò chuyện). */
  public record Edge(Person user, Instant at, UUID matchId) {}

  public record Activity(
      UserRow summary,
      UserDetail detail,
      List<Edge> likesGiven,
      List<Edge> likesReceived,
      List<Edge> matches,
      List<ReportView> reports) {}

  public record BanRequest(@NotNull Boolean banned) {}

  public record ResolveRequest(@NotNull String status) {}

  @GetMapping("/stats")
  @Transactional(readOnly = true)
  public Stats stats() {
    return jdbc.queryForObject(
        """
        SELECT (SELECT count(*) FROM users) AS total,
               (SELECT count(*) FROM users u WHERE NOT EXISTS (SELECT 1 FROM user_profiles p WHERE p.user_id = u.id)) AS no_profile,
               (SELECT count(*) FROM user_profiles p WHERE NOT p.dating_banned AND NOT p.dating_enabled AND %s) AS incomplete,
               (SELECT count(*) FROM user_profiles WHERE dating_enabled AND NOT dating_banned) AS enabled,
               (SELECT count(*) FROM user_profiles WHERE dating_banned) AS banned,
               (SELECT count(*) FROM swipes) AS swipes,
               (SELECT count(*) FROM swipes WHERE liked) AS likes,
               (SELECT count(*) FROM matches) AS matches,
               (SELECT count(*) FROM reports WHERE status = 'OPEN') AS open_reports
        """
            .formatted("(" + INCOMPLETE_SQL + ")"),
        Map.of(),
        (rs, i) ->
            new Stats(
                rs.getLong("total"),
                rs.getLong("no_profile"),
                rs.getLong("incomplete"),
                rs.getLong("enabled"),
                rs.getLong("banned"),
                rs.getLong("swipes"),
                rs.getLong("likes"),
                rs.getLong("matches"),
                rs.getLong("open_reports")));
  }

  /** {@code status}: OPEN (mặc định) hoặc RESOLVED. */
  @GetMapping("/reports")
  @Transactional(readOnly = true)
  public List<ReportView> reports(@RequestParam(defaultValue = "OPEN") String status) {
    return jdbc.query(REPORTS + " WHERE r.status = :status ORDER BY r.created_at DESC", Map.of("status", status), (rs, i) -> report(rs));
  }

  private static final String REPORTS =
      """
      SELECT r.id, r.reason, r.note, r.status, r.created_at,
             a.id AS a_id, a.display_name AS a_display_name, a.email AS a_email, pa.avatar_url AS a_avatar_url,
             b.id AS b_id, b.display_name AS b_display_name, b.email AS b_email, pb.avatar_url AS b_avatar_url
      FROM reports r
      JOIN users a ON a.id = r.reporter_id LEFT JOIN user_profiles pa ON pa.user_id = a.id
      JOIN users b ON b.id = r.reported_id LEFT JOIN user_profiles pb ON pb.user_id = b.id
      """;

  private ReportView report(ResultSet rs) throws SQLException {
    return new ReportView(
        rs.getObject("id", UUID.class),
        person(rs, "a_"),
        person(rs, "b_"),
        ReportReason.valueOf(rs.getString("reason")),
        rs.getString("note"),
        rs.getString("status"),
        instant(rs.getTimestamp("created_at")));
  }

  @PutMapping("/reports/{id}")
  public ResponseEntity<Void> resolve(@PathVariable UUID id, @RequestBody ResolveRequest request) {
    String status = "RESOLVED".equals(request.status()) ? "RESOLVED" : "OPEN";
    int n =
        jdbc.update(
            "UPDATE reports SET status = :status, resolved_at = CASE WHEN :status = 'RESOLVED' THEN now() END WHERE id = :id",
            Map.of("status", status, "id", id));
    if (n == 0) throw ApiException.notFound();
    return ResponseEntity.noContent().build();
  }

  /** Mọi tài khoản (mới đăng ký trước), kèm trạng thái Tìm đối tượng và số liệu hoạt động. */
  @GetMapping("/users")
  @Transactional(readOnly = true)
  public List<UserRow> users() {
    return jdbc.query(USER_ROWS + " ORDER BY u.created_at DESC", Map.of(), (rs, i) -> userRow(rs));
  }

  @GetMapping("/users/{id}")
  @Transactional(readOnly = true)
  public Activity activity(@PathVariable UUID id) {
    UserRow summary =
        jdbc.query(USER_ROWS + " WHERE u.id = :id", Map.of("id", id), (rs, i) -> userRow(rs)).stream()
            .findFirst()
            .orElseThrow(ApiException::notFound);
    return new Activity(
        summary,
        detail(id),
        edges("SELECT s.target_id AS other, s.created_at AS at, NULL::uuid AS match_id FROM swipes s WHERE s.swiper_id = :id AND s.liked", id),
        edges("SELECT s.swiper_id AS other, s.created_at AS at, NULL::uuid AS match_id FROM swipes s WHERE s.target_id = :id AND s.liked", id),
        edges(
            "SELECT CASE WHEN m.user_a = :id THEN m.user_b ELSE m.user_a END AS other, m.created_at AS at,"
                + " m.id AS match_id FROM matches m WHERE m.user_a = :id OR m.user_b = :id",
            id),
        jdbc.query(REPORTS + " WHERE r.reported_id = :id ORDER BY r.created_at DESC", Map.of("id", id), (rs, i) -> report(rs)));
  }

  private UserDetail detail(UUID id) {
    return jdbc.queryForObject(
        """
        SELECT p.gender, p.birthday, p.phone, p.bio, p.avatar_url,
               (SELECT count(*) FROM places pl WHERE pl.user_id = :id) AS saved_places,
               (SELECT count(*) FROM saved_spots ss WHERE ss.user_id = :id) AS saved_spots,
               (SELECT count(*) FROM plans pn WHERE pn.user_id = :id) AS plans
        FROM (SELECT :id AS uid) x LEFT JOIN user_profiles p ON p.user_id = x.uid
        """,
        Map.of("id", id),
        (rs, i) -> {
          LocalDate birthday = rs.getObject("birthday", LocalDate.class);
          List<String> missing = new ArrayList<>();
          if (rs.getString("avatar_url") == null) missing.add("ảnh đại diện");
          if (birthday == null || Period.between(birthday, LocalDate.now()).getYears() < DatingService.MIN_AGE) {
            missing.add("ngày sinh (đủ 18 tuổi)");
          }
          return new UserDetail(
              rs.getString("gender"),
              birthday,
              rs.getString("phone"),
              rs.getString("bio"),
              missing,
              rs.getLong("saved_places"),
              rs.getLong("saved_spots"),
              rs.getLong("plans"));
        });
  }

  /** Admin có toàn quyền: đọc cuộc trò chuyện của một match (cũ trước mới sau, tối đa 500 tin). */
  @GetMapping("/matches/{id}/messages")
  @Transactional(readOnly = true)
  public List<DatingDtos.MessageView> messages(@PathVariable UUID id) {
    if (dating.participants(id).isEmpty()) throw ApiException.notFound();
    return dating.messages(id, null, null, null, 500);
  }

  /** Khoá: không hiện với ai, không quẹt được. Mở khoá: người đó tự bật lại. */
  @PutMapping("/users/{id}/ban")
  public ResponseEntity<Void> ban(@PathVariable UUID id, @RequestBody BanRequest request) {
    int n =
        jdbc.update(
            "UPDATE user_profiles SET dating_banned = :banned, dating_enabled = dating_enabled AND NOT :banned WHERE user_id = :id",
            Map.of("banned", request.banned(), "id", id));
    if (n == 0) throw ApiException.notFound();
    return ResponseEntity.noContent().build();
  }

  /** Hồ sơ thiếu để bật Tìm đối tượng: không ảnh đại diện, hoặc không ngày sinh / chưa đủ 18 tuổi */
  private static final String INCOMPLETE_SQL =
      "p.avatar_url IS NULL OR p.birthday IS NULL OR p.birthday > CURRENT_DATE - INTERVAL '18 years'";

  private static final String USER_ROWS =
      """
      SELECT u.id, u.display_name, u.email, u.username, u.role, u.created_at, p.avatar_url, p.city,
             p.user_id IS NOT NULL AS has_profile,
             COALESCE(p.dating_enabled, false) AS dating_enabled, COALESCE(p.dating_banned, false) AS dating_banned,
             COALESCE(%s, false) AS incomplete,
             (SELECT count(*) FROM swipes s WHERE s.swiper_id = u.id AND s.liked) AS likes_given,
             (SELECT count(*) FROM swipes s WHERE s.target_id = u.id AND s.liked) AS likes_received,
             (SELECT count(*) FROM matches m WHERE m.user_a = u.id OR m.user_b = u.id) AS matches,
             (SELECT count(*) FROM reports r WHERE r.reported_id = u.id) AS reports_against
      FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id
      """
          .formatted("(" + INCOMPLETE_SQL + ")");

  private UserRow userRow(ResultSet rs) throws SQLException {
    boolean enabled = rs.getBoolean("dating_enabled");
    boolean banned = rs.getBoolean("dating_banned");
    DatingStatus status =
        !rs.getBoolean("has_profile")
            ? DatingStatus.NO_PROFILE
            : banned ? DatingStatus.BANNED : enabled ? DatingStatus.ON : rs.getBoolean("incomplete") ? DatingStatus.INCOMPLETE : DatingStatus.OFF;
    return new UserRow(
        person(rs, ""),
        rs.getString("username"),
        rs.getString("role"),
        instant(rs.getTimestamp("created_at")),
        rs.getString("city"),
        status,
        rs.getBoolean("dating_enabled"),
        rs.getBoolean("dating_banned"),
        rs.getLong("likes_given"),
        rs.getLong("likes_received"),
        rs.getLong("matches"),
        rs.getLong("reports_against"));
  }

  private List<Edge> edges(String sql, UUID id) {
    return jdbc.query(
        "SELECT e.at, e.match_id, u.id, u.display_name, u.email, p.avatar_url FROM ("
            + sql
            + ") e JOIN users u ON u.id = e.other LEFT JOIN user_profiles p ON p.user_id = u.id ORDER BY e.at DESC",
        Map.of("id", id),
        (rs, i) ->
            new Edge(person(rs, ""), instant(rs.getTimestamp("at")), rs.getObject("match_id", UUID.class)));
  }

  private static Instant instant(Timestamp t) {
    return t == null ? null : t.toInstant();
  }
}
