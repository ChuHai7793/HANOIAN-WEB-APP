package com.gfmaster.article;

import com.gfmaster.article.ArticleDtos.ArticlePage;
import com.gfmaster.article.ArticleDtos.ArticleRequest;
import com.gfmaster.article.ArticleDtos.ArticleSummary;
import com.gfmaster.article.ArticleDtos.ArticleView;
import com.gfmaster.article.ArticleDtos.SitemapEntry;
import com.gfmaster.common.security.CurrentUser;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Cẩm nang: công khai (bài đã xuất bản, sitemap) và admin ({@code /admin/**}, SecurityConfig chỉ cho ADMIN). */
@RestController
public class ArticleController {

  private final ArticleService articles;

  public ArticleController(ArticleService articles) {
    this.articles = articles;
  }

  @GetMapping("/api/v1/articles")
  public ArticlePage list(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "12") int size) {
    return articles.published(page, size);
  }

  @GetMapping("/api/v1/articles/{slug}")
  public ArticleView get(@PathVariable String slug) {
    return articles.publishedBySlug(slug);
  }

  /** Đường dẫn công khai để frontend dựng sitemap.xml */
  @GetMapping("/api/v1/public/sitemap")
  public List<SitemapEntry> sitemap() {
    return articles.sitemap();
  }

  @GetMapping("/api/v1/admin/articles")
  public List<ArticleSummary> all() {
    return articles.all();
  }

  @GetMapping("/api/v1/admin/articles/{id}")
  public ArticleView byId(@PathVariable UUID id) {
    return articles.byId(id);
  }

  @PostMapping("/api/v1/admin/articles")
  public ResponseEntity<ArticleView> create(@CurrentUser UUID me, @Valid @RequestBody ArticleRequest req) {
    return ResponseEntity.status(HttpStatus.CREATED).body(articles.create(me, req));
  }

  @PutMapping("/api/v1/admin/articles/{id}")
  public ArticleView update(@PathVariable UUID id, @Valid @RequestBody ArticleRequest req) {
    return articles.update(id, req);
  }

  @DeleteMapping("/api/v1/admin/articles/{id}")
  public ResponseEntity<Void> delete(@PathVariable UUID id) {
    articles.delete(id);
    return ResponseEntity.noContent().build();
  }
}
