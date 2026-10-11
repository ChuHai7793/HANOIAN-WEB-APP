package com.gfmaster.dating;

import com.gfmaster.dating.DatingDtos.Candidate;
import com.gfmaster.dating.DatingDtos.LastMessage;
import com.gfmaster.dating.DatingDtos.MessageView;
import com.gfmaster.profile.Gender;
import com.gfmaster.upload.storage.ImageUrls;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * SQL của "Tìm đối tượng". Viết thẳng SQL vì điều kiện chọn người hiện trên thẻ lọc theo cả hai phía
 * (giới tính, tuổi, thành phố của người xem lẫn người được xem).
 */
@Repository
public class DatingRepository {

  /** Cột của một thẻ hồ sơ: {@code u} = users, {@code p} = user_profiles của người được xem. */
  private static final String CARD_COLUMNS =
      """
      u.id, u.display_name, p.avatar_url, p.gender, p.city, p.bio,
      date_part('year', age(p.birthday))::int AS age
      """;

  /** Người được xem đủ điều kiện hiện: đã bật, không bị khoá, có ảnh, đủ 18 tuổi. */
  private static final String VISIBLE =
      """
      p.dating_enabled AND NOT p.dating_banned AND p.avatar_url IS NOT NULL AND p.birthday IS NOT NULL
      AND p.birthday <= current_date - interval '18 years'
      """;

  /** Không có chặn giữa :me và người {@code u.id}, theo cả hai chiều. */
  private static final String NOT_BLOCKED =
      """
      NOT EXISTS (SELECT 1 FROM blocks b
                  WHERE (b.blocker_id = :me AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = :me))
      """;

  private final NamedParameterJdbcTemplate jdbc;
  private final ImageUrls imageUrls;

  public DatingRepository(NamedParameterJdbcTemplate jdbc, ImageUrls imageUrls) {
    this.jdbc = jdbc;
    this.imageUrls = imageUrls;
  }

  /**
   * Thẻ để quẹt: người hiện được, chưa bị mình quẹt, hợp bộ lọc của <b>cả hai</b> bên. Người đã thích
   * mình được xếp trước.
   */
  public List<Candidate> deck(UUID me, int limit) {
    String sql =
        "SELECT "
            + CARD_COLUMNS
            + """
            FROM users u
            JOIN user_profiles p ON p.user_id = u.id
            JOIN user_profiles me ON me.user_id = :me
            WHERE u.id <> :me AND
            """
            + VISIBLE
            + """
              AND NOT EXISTS (SELECT 1 FROM swipes s WHERE s.swiper_id = :me AND s.target_id = u.id)
            """
            // Text block bỏ khoảng trắng cuối dòng: ghép " AND " tường minh, không để "AND" dính "NOT"
            + " AND "
            + NOT_BLOCKED
            + """
              AND (me.interested_in = 'all' OR p.gender = me.interested_in)
              AND (p.interested_in = 'all' OR me.gender = p.interested_in)
              AND date_part('year', age(p.birthday)) BETWEEN me.age_min AND me.age_max
              AND date_part('year', age(me.birthday)) BETWEEN p.age_min AND p.age_max
              AND (NOT me.same_city_only OR lower(trim(p.city)) = lower(trim(me.city)))
              AND (NOT p.same_city_only OR lower(trim(p.city)) = lower(trim(me.city)))
            ORDER BY EXISTS (SELECT 1 FROM swipes l
                             WHERE l.swiper_id = u.id AND l.target_id = :me AND l.liked) DESC,
                     p.updated_at DESC, u.id
            LIMIT :limit
            """;
    return withPhotosAndInterests(jdbc.query(sql, Map.of("me", me, "limit", limit), this::mapCard));
  }

  /** Thẻ của một người bất kỳ (không xét điều kiện hiện), dùng cho match và hoàn tác. */
  public Optional<Candidate> card(UUID userId) {
    String sql = "SELECT " + CARD_COLUMNS + " FROM users u JOIN user_profiles p ON p.user_id = u.id WHERE u.id = :id";
    return withPhotosAndInterests(jdbc.query(sql, Map.of("id", userId), this::mapCard)).stream().findFirst();
  }

  /** Người này có hiện với :me không (đích của một lượt quẹt): hiện được và không chặn nhau. */
  public boolean isVisibleTo(UUID me, UUID userId) {
    String sql =
        "SELECT count(*) FROM users u JOIN user_profiles p ON p.user_id = u.id WHERE u.id = :id AND "
            + VISIBLE
            + " AND "
            + NOT_BLOCKED;
    return jdbc.queryForObject(sql, Map.of("id", userId, "me", me), Long.class) > 0;
  }

  // ---- Bỏ match, chặn, báo cáo ----

  /** Xoá match nếu :me là một trong hai người; false nếu không có. */
  public boolean deleteMatch(UUID me, UUID matchId) {
    return jdbc.update("DELETE FROM matches WHERE id = :id AND (user_a = :me OR user_b = :me)", Map.of("id", matchId, "me", me)) > 0;
  }

  /** Trả về id các match đã xoá (để báo cho người kia). */
  public List<UUID> deleteMatchBetween(UUID x, UUID y) {
    return jdbc.queryForList(
        "DELETE FROM matches WHERE (user_a = :x AND user_b = :y) OR (user_a = :y AND user_b = :x) RETURNING id",
        Map.of("x", x, "y", y),
        UUID.class);
  }

  public void block(UUID blocker, UUID blocked) {
    jdbc.update(
        """
        INSERT INTO blocks (blocker_id, blocked_id, created_at) VALUES (:blocker, :blocked, now())
        ON CONFLICT (blocker_id, blocked_id) DO NOTHING
        """,
        Map.of("blocker", blocker, "blocked", blocked));
  }

  public boolean userExists(UUID id) {
    return jdbc.queryForObject("SELECT count(*) FROM users WHERE id = :id", Map.of("id", id), Long.class) > 0;
  }

  public void insertReport(UUID reporter, UUID reported, String reason, String note) {
    jdbc.update(
        """
        INSERT INTO reports (id, reporter_id, reported_id, reason, note, status, created_at)
        VALUES (:id, :reporter, :reported, :reason, :note, 'OPEN', now())
        """,
        Map.of("id", UUID.randomUUID(), "reporter", reporter, "reported", reported, "reason", reason, "note", note));
  }

  /** false nếu đã quẹt người này rồi. */
  public boolean insertSwipe(UUID swiper, UUID target, boolean liked) {
    return jdbc.update(
            """
            INSERT INTO swipes (swiper_id, target_id, liked, created_at) VALUES (:swiper, :target, :liked, now())
            ON CONFLICT (swiper_id, target_id) DO NOTHING
            """,
            new MapSqlParameterSource().addValue("swiper", swiper).addValue("target", target).addValue("liked", liked))
        > 0;
  }

  public boolean liked(UUID swiper, UUID target) {
    return jdbc.queryForObject(
            "SELECT count(*) FROM swipes WHERE swiper_id = :swiper AND target_id = :target AND liked",
            Map.of("swiper", swiper, "target", target),
            Long.class)
        > 0;
  }

  /** Tạo match cho cặp (thứ tự a < b), có rồi thì giữ nguyên. Trả về id và thời điểm match. */
  public MatchRow upsertMatch(UUID x, UUID y) {
    // So chuỗi hex, không dùng UUID.compareTo: Java so theo số có dấu, Postgres theo byte không dấu → CHECK
    // (user_a < user_b) có thể từ chối.
    UUID a = x.toString().compareTo(y.toString()) < 0 ? x : y;
    UUID b = a.equals(x) ? y : x;
    var params = Map.of("id", UUID.randomUUID(), "a", a, "b", b);
    jdbc.update(
        "INSERT INTO matches (id, user_a, user_b, created_at) VALUES (:id, :a, :b, now()) ON CONFLICT (user_a, user_b) DO NOTHING",
        params);
    return jdbc.queryForObject(
        "SELECT id, created_at FROM matches WHERE user_a = :a AND user_b = :b",
        params,
        (rs, i) -> new MatchRow(rs.getObject("id", UUID.class), toInstant(rs.getTimestamp("created_at"))));
  }

  public record MatchRow(UUID id, Instant createdAt) {}

  public boolean matched(UUID x, UUID y) {
    return jdbc.queryForObject(
            "SELECT count(*) FROM matches WHERE (user_a = :x AND user_b = :y) OR (user_a = :y AND user_b = :x)",
            Map.of("x", x, "y", y),
            Long.class)
        > 0;
  }

  /** Lượt quẹt gần nhất của {@code me}: id người được quẹt và có thích không. */
  public Optional<LastSwipe> lastSwipe(UUID me) {
    return jdbc.query(
            "SELECT target_id, liked FROM swipes WHERE swiper_id = :me ORDER BY created_at DESC LIMIT 1",
            Map.of("me", me),
            (rs, i) -> new LastSwipe(rs.getObject("target_id", UUID.class), rs.getBoolean("liked")))
        .stream()
        .findFirst();
  }

  public record LastSwipe(UUID targetId, boolean liked) {}

  public void deleteSwipe(UUID swiper, UUID target) {
    jdbc.update("DELETE FROM swipes WHERE swiper_id = :swiper AND target_id = :target", Map.of("swiper", swiper, "target", target));
  }

  /**
   * Match của {@code me} kèm tin nhắn gần nhất và số tin chưa đọc; cuộc trò chuyện có hoạt động gần nhất
   * đứng trước (chưa nhắn thì tính theo lúc match).
   */
  public List<MatchListRow> matchesOf(UUID me) {
    return jdbc.query(
        """
        SELECT m.id, m.created_at, CASE WHEN m.user_a = :me THEN m.user_b ELSE m.user_a END AS other,
               last.body AS last_body, last.sender_id AS last_sender, last.created_at AS last_at,
               (SELECT count(*) FROM messages u
                WHERE u.match_id = m.id AND u.sender_id <> :me AND u.read_at IS NULL) AS unread
        FROM matches m
        LEFT JOIN LATERAL (SELECT body, sender_id, created_at FROM messages x
                           WHERE x.match_id = m.id ORDER BY x.created_at DESC LIMIT 1) last ON true
        WHERE m.user_a = :me OR m.user_b = :me
        ORDER BY coalesce(last.created_at, m.created_at) DESC
        """,
        Map.of("me", me),
        (rs, i) -> {
          String body = rs.getString("last_body");
          LastMessage last =
              body == null
                  ? null
                  : new LastMessage(body, me.equals(rs.getObject("last_sender", UUID.class)), toInstant(rs.getTimestamp("last_at")));
          return new MatchListRow(
              rs.getObject("id", UUID.class),
              rs.getObject("other", UUID.class),
              toInstant(rs.getTimestamp("created_at")),
              last,
              rs.getInt("unread"));
        });
  }

  public record MatchListRow(UUID id, UUID otherUserId, Instant createdAt, LastMessage lastMessage, int unread) {}

  // ---- Tin nhắn ----

  /** Hai người của một match: [user_a, user_b]; rỗng nếu không có match. */
  public Optional<UUID[]> participants(UUID matchId) {
    return jdbc.query(
            "SELECT user_a, user_b FROM matches WHERE id = :id",
            Map.of("id", matchId),
            (rs, i) -> new UUID[] {rs.getObject("user_a", UUID.class), rs.getObject("user_b", UUID.class)})
        .stream()
        .findFirst();
  }

  public MessageView insertMessage(UUID matchId, UUID sender, String body) {
    UUID id = UUID.randomUUID();
    jdbc.update(
        "INSERT INTO messages (id, match_id, sender_id, body, created_at) VALUES (:id, :match, :sender, :body, now())",
        Map.of("id", id, "match", matchId, "sender", sender, "body", body));
    return queryMessages(matchId, sender, "id = :mid", Map.of("mid", id), "ASC", 1).getFirst();
  }

  /**
   * Tin nhắn của một match, cũ trước mới sau. {@code after}: chỉ lấy tin mới hơn (hỏi định kỳ khi đang mở
   * cuộc trò chuyện); {@code before}: tin cũ hơn (cuộn lên). Không có cả hai: {@code limit} tin gần nhất.
   */
  public List<MessageView> messages(UUID matchId, UUID viewer, Instant after, Instant before, int limit) {
    if (after != null) {
      return queryMessages(matchId, viewer, "created_at > :after", Map.of("after", Timestamp.from(after)), "ASC", limit);
    }
    String where = before == null ? "true" : "created_at < :before";
    Map<String, Object> extra = before == null ? Map.of() : Map.of("before", Timestamp.from(before));
    return queryMessages(matchId, viewer, where, extra, "DESC", limit).reversed();
  }

  private List<MessageView> queryMessages(
      UUID matchId, UUID viewer, String where, Map<String, Object> extra, String order, int limit) {
    Map<String, Object> params = new HashMap<>(extra);
    params.put("match", matchId);
    params.put("limit", limit);
    return jdbc.query(
        "SELECT id, sender_id, body, created_at, read_at FROM messages WHERE match_id = :match AND "
            + where
            + " ORDER BY created_at "
            + order
            + ", id "
            + order
            + " LIMIT :limit",
        params,
        (rs, i) -> {
          UUID sender = rs.getObject("sender_id", UUID.class);
          return new MessageView(
              rs.getObject("id", UUID.class),
              sender,
              viewer != null && viewer.equals(sender),
              rs.getString("body"),
              toInstant(rs.getTimestamp("created_at")),
              toInstant(rs.getTimestamp("read_at")));
        });
  }

  /** Đánh dấu đã xem mọi tin người kia gửi trong match. */
  public int markRead(UUID matchId, UUID reader) {
    return jdbc.update(
        "UPDATE messages SET read_at = now() WHERE match_id = :match AND sender_id <> :reader AND read_at IS NULL",
        Map.of("match", matchId, "reader", reader));
  }

  /** Gắn ảnh thêm và sở thích (hai truy vấn cho cả danh sách, không N+1). */
  private List<Candidate> withPhotosAndInterests(List<Candidate> cards) {
    if (cards.isEmpty()) return cards;
    Map<String, Object> ids = Map.of("ids", cards.stream().map(Candidate::userId).toList());
    Map<UUID, List<String>> photos = new HashMap<>();
    jdbc.query(
        "SELECT user_id, url FROM profile_photos WHERE user_id IN (:ids) ORDER BY user_id, position",
        ids,
        (ResultSet rs) -> {
          photos.computeIfAbsent(rs.getObject("user_id", UUID.class), k -> new ArrayList<>())
              .add(imageUrls.toPublic(rs.getString("url")));
        });
    Map<UUID, List<String>> interests = new HashMap<>();
    jdbc.query(
        "SELECT user_id, interest FROM profile_interests WHERE user_id IN (:ids) ORDER BY user_id, position",
        ids,
        (ResultSet rs) -> {
          interests.computeIfAbsent(rs.getObject("user_id", UUID.class), k -> new ArrayList<>())
              .add(rs.getString("interest"));
        });
    return cards.stream()
        .map(
            c ->
                new Candidate(
                    c.userId(),
                    c.displayName(),
                    c.age(),
                    c.gender(),
                    c.city(),
                    c.bio(),
                    c.avatarUrl(),
                    photos.getOrDefault(c.userId(), List.of()),
                    interests.getOrDefault(c.userId(), List.of())))
        .toList();
  }

  private Candidate mapCard(ResultSet rs, int row) throws SQLException {
    String gender = rs.getString("gender");
    return new Candidate(
        rs.getObject("id", UUID.class),
        rs.getString("display_name"),
        rs.getInt("age"),
        gender == null ? null : Gender.valueOf(gender),
        rs.getString("city"),
        rs.getString("bio"),
        imageUrls.toPublic(rs.getString("avatar_url")),
        List.of(),
        List.of());
  }

  private static Instant toInstant(Timestamp t) {
    return t == null ? null : t.toInstant();
  }
}
