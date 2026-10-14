package com.gfmaster.upload;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ImageKeysTest {

  @Test
  void slugIsReadableAsciiWithoutDiacritics() {
    assertThat(ImageKeys.slug("Cafe Cuối Ngõ")).isEqualTo("cafe-cuoi-ngo");
    assertThat(ImageKeys.slug("Đồng Xuân — Chợ đêm!")).isEqualTo("dong-xuan-cho-dem");
    assertThat(ImageKeys.slug("../../etc/passwd")).isEqualTo("etc-passwd");
    assertThat(ImageKeys.slug("  ")).isEqualTo("anh");
    assertThat(ImageKeys.slug(null)).isEqualTo("anh");
    assertThat(ImageKeys.slug("a".repeat(80))).hasSize(ImageKeys.MAX_SLUG);
  }

  @Test
  void keyHasPurposeFolderDateNameAndRandomSuffix() {
    String key = ImageKeys.newPublicKey(ImagePurpose.spot, "Bảo tàng Phụ nữ Việt Nam");
    assertThat(key).matches("spots/\\d{4}/\\d{2}/bao-tang-phu-nu-viet-nam-[a-z0-9]{8}\\.webp");
    assertThat(ImageKeys.newPublicKey(ImagePurpose.spot, "x")).isNotEqualTo(ImageKeys.newPublicKey(ImagePurpose.spot, "x"));
    assertThat(ImagePurpose.parse("hacker")).isEqualTo(ImagePurpose.misc);
    assertThat(ImagePurpose.parse("girlfriend").folder).isEqualTo("girlfriends");
  }
}
