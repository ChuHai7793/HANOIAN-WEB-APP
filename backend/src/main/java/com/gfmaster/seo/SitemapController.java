package com.gfmaster.seo;

import com.gfmaster.seo.SitemapService.Entry;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Công khai (SecurityConfig mở {@code /api/v1/public/**}): server SSR gọi để dựng sitemap.xml. */
@RestController
public class SitemapController {

  private final SitemapService sitemap;

  public SitemapController(SitemapService sitemap) {
    this.sitemap = sitemap;
  }

  @GetMapping("/api/v1/public/sitemap")
  public List<Entry> sitemap() {
    return sitemap.entries();
  }
}
