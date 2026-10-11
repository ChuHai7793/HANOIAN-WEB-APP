package com.gfmaster.dating;

import com.gfmaster.dating.DatingDtos.Candidate;
import com.gfmaster.profile.Gender;
import com.gfmaster.upload.storage.ImageUrls;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
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

  /** Người được xem đủ điều kiện hiện: đã bật, có ảnh, đủ 18 tuổi. */
  private static final String VISIBLE =
      """
      p.dating_enabled AND p.avatar_url IS NOT NULL AND p.birthday IS NOT NULL
      AND p.birthday <= current_date - interval '18 years'
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
    return jdbc.query(sql, Map.of("me", me, "limit", limit), this::mapCard);
  }

  /** Thẻ của một người bất kỳ (không xét điều kiện hiện), dùng cho match và hoàn tác. */
  public Optional<Candidate> card(UUID userId) {
    String sql = "SELECT " + CARD_COLUMNS + " FROM users u JOIN user_profiles p ON p.user_id = u.id WHERE u.id = :id";
    return jdbc.query(sql, Map.of("id", userId), this::mapCard).stream().findFirst();
  }

  /** Người này có đang hiện trong "Tìm đối tượng" không (đích của một lượt quẹt). */
  public boolean isVisible(UUID userId) {
    String sql = "SELECT count(*) FROM user_profiles p WHERE p.user_id = :id AND " + VISIBLE;
    return jdbc.queryForObject(sql, Map.of("id", userId), Long.class) > 0;
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
    UUID a = x.compareTo(y) < 0 ? x : y;
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

  /** Match của {@code me}, mới nhất trước: id match, người kia, thời điểm. */
  public List<MatchListRow> matchesOf(UUID me) {
    return jdbc.query(
        """
        SELECT id, created_at, CASE WHEN user_a = :me THEN user_b ELSE user_a END AS other
        FROM matches WHERE user_a = :me OR user_b = :me ORDER BY created_at DESC
        """,
        Map.of("me", me),
        (rs, i) ->
            new MatchListRow(
                rs.getObject("id", UUID.class),
                rs.getObject("other", UUID.class),
                toInstant(rs.getTimestamp("created_at"))));
  }

  public record MatchListRow(UUID id, UUID otherUserId, Instant createdAt) {}

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
