package com.gfmaster.upload.storage;

import static org.assertj.core.api.Assertions.assertThat;

import com.gfmaster.config.GfmProperties;
import org.junit.jupiter.api.Test;
import org.springframework.util.unit.DataSize;

class ImageUrlsTest {

  private static ImageUrls withBase(String base) {
    GfmProperties.Storage storage =
        new GfmProperties.Storage("local", "u", "i", base, DataSize.ofMegabytes(12), null);
    return new ImageUrls(new GfmProperties(null, null, null, null, null, storage, null, null, null, null));
  }

  @Test
  void localBaseKeepsUrlsAsIs() {
    ImageUrls urls = withBase("/uploads");
    assertThat(urls.toPublic("/uploads/u1/2026/09/a.webp")).isEqualTo("/uploads/u1/2026/09/a.webp");
    assertThat(urls.toStored("/uploads/u1/2026/09/a.webp")).isEqualTo("/uploads/u1/2026/09/a.webp");
  }

  @Test
  void cdnBaseIsAppliedOnTheWayOutAndRemovedOnTheWayIn() {
    ImageUrls urls = withBase("https://img.example.com/");
    assertThat(urls.toPublic("/uploads/u1/a.webp")).isEqualTo("https://img.example.com/u1/a.webp");
    assertThat(urls.toStored("https://img.example.com/u1/a.webp")).isEqualTo("/uploads/u1/a.webp");
  }

  @Test
  void externalLinksAndEmptyValuesAreUntouched() {
    ImageUrls urls = withBase("https://img.example.com");
    String unsplash = "https://images.unsplash.com/photo-1?w=600";
    assertThat(urls.toPublic(unsplash)).isEqualTo(unsplash);
    assertThat(urls.toStored(unsplash)).isEqualTo(unsplash);
    assertThat(urls.toPublic("")).isEmpty();
    assertThat(urls.toPublic(null)).isNull();
    // Cùng tiền tố nhưng không phải thư mục con của CDN: không đụng vào
    assertThat(urls.toStored("https://img.example.com.evil/x.webp")).isEqualTo("https://img.example.com.evil/x.webp");
  }
}
