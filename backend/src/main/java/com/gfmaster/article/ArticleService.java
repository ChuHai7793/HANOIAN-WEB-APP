package com.gfmaster.article;

import com.gfmaster.article.ArticleDtos.ArticlePage;
import com.gfmaster.article.ArticleDtos.ArticleRequest;
import com.gfmaster.article.ArticleDtos.ArticleSummary;
import com.gfmaster.article.ArticleDtos.ArticleView;
import com.gfmaster.article.ArticleDtos.SitemapEntry;
import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.error.ErrorCode;
import com.gfmaster.common.web.Slugs;
import com.gfmaster.upload.storage.ImageUrls;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * "Cẩm nang": bài viết SEO. Khách xem bài đã xuất bản; admin soạn, sửa, xoá, lưu nháp / xuất bản. Thời điểm xuất
 * bản ghi lần đầu chuyển sang published (sửa sau không đổi).
 */
@Service
public class ArticleService {

  static final int MAX_PAGE_SIZE = 50;

  private static final String SUMMARY_COLS = "id, slug, title, excerpt, cover_url, status, published_at, updated_at";

  private final NamedParameterJdbcTemplate jdbc;
  private final ImageUrls imageUrls;

  public ArticleService(NamedParameterJdbcTemplate jdbc, ImageUrls imageUrls) {
    this.jdbc = jdbc;
    this.imageUrls = imageUrls;
  }

  // ---- Công khai ----

  @Transactional(readOnly = true)
  public ArticlePage published(int page, int size) {
    int p = Math.max(0, page);
    int s = Math.clamp(size, 1, MAX_PAGE_SIZE);
    List<ArticleSummary> items =
        jdbc.query(
            "SELECT " + SUMMARY_COLS + " FROM articles WHERE status = 'published' ORDER BY published_at DESC, id LIMIT :limit OFFSET :offset",
            Map.of("limit", s, "offset", (long) p * s),
            (rs, i) -> summary(rs));
    Long total = jdbc.queryForObject("SELECT count(*) FROM articles WHERE status = 'published'", Map.of(), Long.class);
    return new ArticlePage(items, total == null ? 0 : total, p, s);
  }

  @Transactional(readOnly = true)
  public ArticleView publishedBySlug(String slug) {
    return find("a.slug = :key AND a.status = 'published'", slug);
  }

  /** Đường dẫn công khai cho sitemap.xml: quán, chỗ chơi, bài viết đã xuất bản */
  @Transactional(readOnly = true)
  public List<SitemapEntry> sitemap() {
    List<SitemapEntry> out = new ArrayList<>();
    out.addAll(jdbc.query("SELECT '/quan/' || slug AS path, updated_at FROM place_catalog WHERE slug IS NOT NULL ORDER BY slug", Map.of(), (rs, i) -> entry(rs)));
    out.addAll(jdbc.query("SELECT '/cho-choi/' || slug AS path, updated_at FROM date_spots WHERE slug IS NOT NULL ORDER BY slug", Map.of(), (rs, i) -> entry(rs)));
    out.addAll(jdbc.query("SELECT '/cam-nang/' || slug AS path, updated_at FROM articles WHERE status = 'published' ORDER BY published_at DESC", Map.of(), (rs, i) -> entry(rs)));
    return out;
  }

  // ---- Admin ----

  @Transactional(readOnly = true)
  public List<ArticleSummary> all() {
    return jdbc.query("SELECT " + SUMMARY_COLS + " FROM articles ORDER BY updated_at DESC", Map.of(), (rs, i) -> summary(rs));
  }

  @Transactional(readOnly = true)
  public ArticleView byId(UUID id) {
    return find("a.id = CAST(:key AS uuid)", id.toString());
  }

  @Transactional
  public ArticleView create(UUID author, ArticleRequest req) {
    UUID id = UUID.randomUUID();
    String slug = slugFor(req, null);
    String status = req.status() == null ? "draft" : req.status();
    Timestamp now = Timestamp.from(Instant.now());
    insertOrConflict(
        """
        INSERT INTO articles (id, slug, title, excerpt, cover_url, body, status, published_at, author_id, created_at, updated_at)
        VALUES (:id, :slug, :title, :excerpt, :cover, :body, :status, :published, :author, :now, :now)
        """,
        params(req, slug, status)
            .addValue("id", id)
            .addValue("published", "published".equals(status) ? now : null)
            .addValue("author", author)
            .addValue("now", now));
    return byId(id);
  }

  @Transactional
  public ArticleView update(UUID id, ArticleRequest req) {
    byId(id); // 404 nếu không có
    String slug = slugFor(req, id);
    String status = req.status() == null ? "draft" : req.status();
    insertOrConflict(
        """
        UPDATE articles SET slug = :slug, title = :title, excerpt = :excerpt, cover_url = :cover, body = :body,
               status = :status, updated_at = :now,
               published_at = CASE WHEN :status = 'published' THEN COALESCE(published_at, :now) ELSE published_at END
        WHERE id = :id
        """,
        params(req, slug, status).addValue("id", id).addValue("now", Timestamp.from(Instant.now())));
    return byId(id);
  }

  @Transactional
  public void delete(UUID id) {
    if (jdbc.update("DELETE FROM articles WHERE id = :id", Map.of("id", id)) == 0) throw ApiException.notFound();
  }

  // ---- Nội bộ ----

  /** Slug admin nhập, hoặc tạo từ tiêu đề (không trùng bài khác) */
  private String slugFor(ArticleRequest req, UUID self) {
    String wanted = req.slug() == null || req.slug().isBlank() ? null : req.slug().strip();
    if (wanted != null) return wanted;
    return Slugs.unique(req.title(), "bai-viet", s -> taken(s, self));
  }

  private boolean taken(String slug, UUID self) {
    return Boolean.TRUE.equals(
        jdbc.queryForObject(
            "SELECT EXISTS (SELECT 1 FROM articles WHERE slug = :slug AND (CAST(:self AS uuid) IS NULL OR id <> CAST(:self AS uuid)))",
            new MapSqlParameterSource("slug", slug).addValue("self", self == null ? null : self.toString()),
            Boolean.class));
  }

  private void insertOrConflict(String sql, MapSqlParameterSource params) {
    try {
      jdbc.update(sql, params);
    } catch (DuplicateKeyException e) {
      throw new ApiException(ErrorCode.DATA_CONFLICT, "Đường dẫn bài viết đã được dùng, hãy đổi đường dẫn khác.");
    }
  }

  private MapSqlParameterSource params(ArticleRequest req, String slug, String status) {
    String cover = req.coverUrl() == null || req.coverUrl().isBlank() ? null : imageUrls.toStored(req.coverUrl().strip());
    return new MapSqlParameterSource("slug", slug)
        .addValue("title", req.title().strip())
        .addValue("excerpt", req.excerpt() == null ? "" : req.excerpt().strip())
        .addValue("cover", cover)
        .addValue("body", req.body() == null ? "" : req.body())
        .addValue("status", status);
  }

  private ArticleView find(String where, String key) {
    List<ArticleView> rows =
        jdbc.query(
            """
            SELECT a.id, a.slug, a.title, a.excerpt, a.cover_url, a.body, a.status, a.published_at, a.updated_at,
                   u.display_name
            FROM articles a LEFT JOIN users u ON u.id = a.author_id
            WHERE """
                + " "
                + where,
            Map.of("key", key),
            (rs, i) ->
                new ArticleView(
                    rs.getObject("id", UUID.class),
                    rs.getString("slug"),
                    rs.getString("title"),
                    rs.getString("excerpt"),
                    imageUrls.toPublic(rs.getString("cover_url")),
                    rs.getString("body"),
                    rs.getString("status"),
                    rs.getString("display_name"),
                    instant(rs, "published_at"),
                    instant(rs, "updated_at")));
    if (rows.isEmpty()) throw ApiException.notFound();
    return rows.getFirst();
  }

  private ArticleSummary summary(ResultSet rs) throws SQLException {
    return new ArticleSummary(
        rs.getObject("id", UUID.class),
        rs.getString("slug"),
        rs.getString("title"),
        rs.getString("excerpt"),
        imageUrls.toPublic(rs.getString("cover_url")),
        rs.getString("status"),
        instant(rs, "published_at"),
        instant(rs, "updated_at"));
  }

  private static SitemapEntry entry(ResultSet rs) throws SQLException {
    return new SitemapEntry(rs.getString("path"), instant(rs, "updated_at"));
  }

  private static Instant instant(ResultSet rs, String col) throws SQLException {
    Timestamp t = rs.getTimestamp(col);
    return t == null ? null : t.toInstant();
  }
}
