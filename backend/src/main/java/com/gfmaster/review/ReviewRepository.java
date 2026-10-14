package com.gfmaster.review;

import com.gfmaster.review.ReviewDtos.Author;
import com.gfmaster.review.ReviewDtos.ReviewSort;
import com.gfmaster.review.ReviewDtos.ReviewView;
import com.gfmaster.review.ReviewDtos.TargetType;
import com.gfmaster.upload.storage.ImageUrls;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class ReviewRepository {

  private static final String SELECT =
      """
      SELECT r.id, r.user_id, u.display_name, p.avatar_url, r.rating, r.body, r.companion, r.helpful_count,
             r.created_at, r.updated_at,
             EXISTS (SELECT 1 FROM review_votes v WHERE v.review_id = r.id AND v.user_id = CAST(:me AS uuid)) AS helped
      FROM reviews r
      JOIN users u ON u.id = r.user_id
      LEFT JOIN user_profiles p ON p.user_id = r.user_id
      """;

  private final NamedParameterJdbcTemplate jdbc;
  private final ImageUrls imageUrls;

  public ReviewRepository(NamedParameterJdbcTemplate jdbc, ImageUrls imageUrls) {
    this.jdbc = jdbc;
    this.imageUrls = imageUrls;
  }

  boolean targetExists(TargetType type, UUID id) {
    return Boolean.TRUE.equals(
        jdbc.queryForObject(
            "SELECT EXISTS (SELECT 1 FROM " + type.table + " WHERE id = :id)", Map.of("id", id), Boolean.class));
  }

  /** Đánh giá của mọi người trừ {@code me} (đánh giá của mình trả riêng), theo {@code sort}. */
  List<ReviewView> page(TargetType type, UUID target, UUID me, ReviewSort sort, int page, int size) {
    String order =
        switch (sort) {
          case helpful -> "r.helpful_count DESC, r.created_at DESC";
          case newest -> "r.created_at DESC";
          case high -> "r.rating DESC, r.helpful_count DESC, r.created_at DESC";
          case low -> "r.rating ASC, r.helpful_count DESC, r.created_at DESC";
        };
    return jdbc.query(
        SELECT
            + """
            WHERE r.target_type = :type AND r.target_id = :target
              AND (CAST(:me AS uuid) IS NULL OR r.user_id <> CAST(:me AS uuid))
            ORDER BY\s"""
            + order
            + " LIMIT :limit OFFSET :offset",
        params(type, target, me).addValue("limit", size).addValue("offset", (long) page * size),
        (rs, i) -> row(rs, me));
  }

  long countOthers(TargetType type, UUID target, UUID me) {
    Long n =
        jdbc.queryForObject(
            """
            SELECT count(*) FROM reviews
            WHERE target_type = :type AND target_id = :target
              AND (CAST(:me AS uuid) IS NULL OR user_id <> CAST(:me AS uuid))
            """,
            params(type, target, me),
            Long.class);
    return n == null ? 0 : n;
  }

  Optional<ReviewView> findMine(TargetType type, UUID target, UUID me) {
    if (me == null) return Optional.empty();
    return jdbc
        .query(
            SELECT + " WHERE r.target_type = :type AND r.target_id = :target AND r.user_id = CAST(:me AS uuid)",
            params(type, target, me),
            (rs, i) -> row(rs, me))
        .stream()
        .findFirst();
  }

  /** Số đánh giá theo mức sao: [1 sao, 2 sao, …, 5 sao] */
  List<Integer> histogram(TargetType type, UUID target) {
    Integer[] counts = new Integer[] {0, 0, 0, 0, 0};
    jdbc.query(
        "SELECT rating, count(*) AS n FROM reviews WHERE target_type = :type AND target_id = :target GROUP BY rating",
        params(type, target, null),
        rs -> {
          counts[rs.getInt("rating") - 1] = rs.getInt("n");
        });
    return Arrays.asList(counts);
  }

  /** Tạo hoặc sửa đánh giá của {@code me} (mỗi người một đánh giá cho mỗi địa điểm). */
  void upsert(TargetType type, UUID target, UUID me, int rating, String body, String companion) {
    Timestamp now = Timestamp.from(Instant.now());
    jdbc.update(
        """
        INSERT INTO reviews (id, target_type, target_id, user_id, rating, body, companion, created_at, updated_at)
        VALUES (:id, :type, :target, CAST(:me AS uuid), :rating, :body, :companion, :now, :now)
        ON CONFLICT (target_type, target_id, user_id)
        DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body, companion = EXCLUDED.companion,
                      updated_at = EXCLUDED.updated_at
        """,
        params(type, target, me)
            .addValue("id", UUID.randomUUID())
            .addValue("rating", rating)
            .addValue("body", body)
            .addValue("companion", companion)
            .addValue("now", now));
  }

  boolean deleteMine(TargetType type, UUID target, UUID me) {
    return jdbc.update(
            "DELETE FROM reviews WHERE target_type = :type AND target_id = :target AND user_id = CAST(:me AS uuid)",
            params(type, target, me))
        > 0;
  }

  /** Tính lại điểm trung bình và số đánh giá lưu trên địa điểm. */
  void refreshAggregate(TargetType type, UUID target) {
    jdbc.update(
        "UPDATE "
            + type.table
            + """
             SET rating_avg = s.avg, rating_count = s.n
            FROM (SELECT round(avg(rating)::numeric, 1) AS avg, count(*) AS n
                  FROM reviews WHERE target_type = :type AND target_id = :target) s
            WHERE id = :target
            """,
        params(type, target, null));
  }

  record ReviewOwner(UUID userId, int helpfulCount) {}

  Optional<ReviewOwner> owner(UUID reviewId) {
    return jdbc
        .query(
            "SELECT user_id, helpful_count FROM reviews WHERE id = :id",
            Map.of("id", reviewId),
            (rs, i) -> new ReviewOwner(rs.getObject("user_id", UUID.class), rs.getInt("helpful_count")))
        .stream()
        .findFirst();
  }

  /** @return số "Hữu ích" mới, hoặc rỗng nếu người này đã bấm từ trước */
  Optional<Integer> addVote(UUID reviewId, UUID me) {
    int inserted =
        jdbc.update(
            """
            INSERT INTO review_votes (review_id, user_id, created_at) VALUES (:id, :me, :now)
            ON CONFLICT DO NOTHING
            """,
            new MapSqlParameterSource("id", reviewId).addValue("me", me).addValue("now", Timestamp.from(Instant.now())));
    return inserted == 0 ? Optional.empty() : Optional.of(bumpHelpful(reviewId, 1));
  }

  Optional<Integer> removeVote(UUID reviewId, UUID me) {
    int deleted =
        jdbc.update(
            "DELETE FROM review_votes WHERE review_id = :id AND user_id = :me",
            new MapSqlParameterSource("id", reviewId).addValue("me", me));
    return deleted == 0 ? Optional.empty() : Optional.of(bumpHelpful(reviewId, -1));
  }

  private int bumpHelpful(UUID reviewId, int delta) {
    Integer n =
        jdbc.queryForObject(
            "UPDATE reviews SET helpful_count = helpful_count + :delta WHERE id = :id RETURNING helpful_count",
            new MapSqlParameterSource("id", reviewId).addValue("delta", delta),
            Integer.class);
    return n == null ? 0 : n;
  }

  private static MapSqlParameterSource params(TargetType type, UUID target, UUID me) {
    return new MapSqlParameterSource("type", type.name())
        .addValue("target", target)
        .addValue("me", me == null ? null : me.toString());
  }

  private ReviewView row(ResultSet rs, UUID me) throws SQLException {
    UUID author = rs.getObject("user_id", UUID.class);
    return new ReviewView(
        rs.getObject("id", UUID.class),
        new Author(author, rs.getString("display_name"), imageUrls.toPublic(rs.getString("avatar_url"))),
        rs.getInt("rating"),
        rs.getString("body"),
        rs.getString("companion"),
        rs.getInt("helpful_count"),
        rs.getBoolean("helped"),
        author.equals(me),
        rs.getTimestamp("created_at").toInstant(),
        rs.getTimestamp("updated_at").toInstant());
  }

  /** Dùng trong test / chỗ khác cần đọc nhanh điểm trên địa điểm */
  BigDecimal storedAverage(TargetType type, UUID target) {
    List<BigDecimal> v = new ArrayList<>();
    jdbc.query(
        "SELECT rating_avg FROM " + type.table + " WHERE id = :id",
        Map.of("id", target),
        rs -> {
          v.add(rs.getBigDecimal(1));
        });
    return v.isEmpty() ? null : v.get(0);
  }
}
