package com.gfmaster.upload.storage;

import java.net.URI;
import java.time.Duration;
import java.util.Optional;
import java.util.OptionalLong;

/**
 * Vùng lưu <b>riêng tư</b> cho ảnh gốc trình duyệt upload thẳng lên, trước khi worker xử lý (xoay
 * EXIF, resize, WebP, bỏ metadata) và chuyển sang storage công khai. Không bao giờ phục vụ công khai:
 * ảnh gốc có thể còn toạ độ GPS, hoặc không phải ảnh.
 */
public interface IncomingStorage {

  /**
   * URL có chữ ký để trình duyệt {@code PUT} thẳng file, chỉ đúng {@code contentType} và đúng
   * {@code contentLength} byte, hết hạn sau {@code ttl}. Rỗng nếu driver không hỗ trợ (local): khi đó
   * trình duyệt PUT vào endpoint của backend.
   */
  Optional<URI> presignPut(String key, String contentType, long contentLength, Duration ttl);

  /** Dùng cho endpoint PUT của backend (driver local) và test. */
  void put(String key, byte[] content, String contentType);

  byte[] get(String key);

  /** Kích thước file đã upload; rỗng nếu chưa có. */
  OptionalLong size(String key);

  void delete(String key);
}
