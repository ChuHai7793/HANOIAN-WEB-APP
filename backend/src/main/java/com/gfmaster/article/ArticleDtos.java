package com.gfmaster.article;

import com.gfmaster.place.dto.PlaceRequest;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class ArticleDtos {

  private ArticleDtos() {}

  /** Thẻ bài trong danh sách Cẩm nang; {@code venueCount}: số quán / chỗ chơi nhúng trong bài (thẻ "bộ sưu tập" ở trang chủ) */
  public record ArticleSummary(
      UUID id,
      String slug,
      String title,
      String excerpt,
      String coverUrl,
      String status,
      Instant publishedAt,
      Instant updatedAt,
      int venueCount) {}

  public record ArticleView(
      UUID id,
      String slug,
      String title,
      String excerpt,
      String coverUrl,
      /** Markdown; dòng [[quan:slug]] / [[cho-choi:slug]] là thẻ quán / chỗ chơi */
      String body,
      String status,
      String authorName,
      Instant publishedAt,
      Instant updatedAt) {}

  public record ArticlePage(List<ArticleSummary> items, long total, int page, int size) {}

  public record ArticleRequest(
      @NotBlank @Size(max = 160) String title,
      /** Trống: tự tạo từ tiêu đề */
      @Size(max = 90) @Pattern(regexp = "^$|^[a-z0-9]+(-[a-z0-9]+)*$", message = "chỉ gồm chữ thường không dấu, số và dấu -") String slug,
      @Size(max = 300) String excerpt,
      @Size(max = 1024) @Pattern(regexp = PlaceRequest.IMAGE_URL, message = "Chỉ nhận URL http(s) hoặc /uploads/") String coverUrl,
      @Size(max = 100_000) String body,
      @Pattern(regexp = "draft|published") String status) {}

  /** Dữ liệu cho sitemap.xml của frontend */
  public record SitemapEntry(String path, Instant updatedAt) {}
}
