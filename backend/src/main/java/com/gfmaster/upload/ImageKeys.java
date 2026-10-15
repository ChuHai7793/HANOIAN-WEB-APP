package com.gfmaster.upload;

import com.gfmaster.common.web.Slugs;
import java.security.SecureRandom;
import java.time.LocalDate;

/**
 * Tên file ảnh trên storage công khai: {@code {thư mục loại ảnh}/{yyyy}/{MM}/{tên-dễ-đọc}-{8 ký tự ngẫu nhiên}.webp},
 * vd. {@code places/2026/10/cafe-cuoi-ngo-k3f9a1c2.webp}. Phần ngẫu nhiên giữ cho hai ảnh cùng tên không đè nhau
 * và người ngoài không đoán được URL để tải hàng loạt. Không có id người dùng trong URL.
 */
final class ImageKeys {

  static final int MAX_SLUG = 50;
  private static final String ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
  private static final SecureRandom RANDOM = new SecureRandom();

  private ImageKeys() {}

  static String newPublicKey(ImagePurpose purpose, String nameHint) {
    LocalDate today = LocalDate.now();
    return "%s/%d/%02d/%s-%s.webp"
        .formatted(purpose.folder, today.getYear(), today.getMonthValue(), slug(nameHint), randomSuffix());
  }

  /** "Cafe Cuối Ngõ!" → "cafe-cuoi-ngo"; chỉ a-z, 0-9, "-"; rỗng thì "anh". */
  static String slug(String value) {
    return Slugs.of(value, MAX_SLUG, "anh");
  }

  private static String randomSuffix() {
    StringBuilder sb = new StringBuilder(8);
    for (int i = 0; i < 8; i++) sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
    return sb.toString();
  }
}
