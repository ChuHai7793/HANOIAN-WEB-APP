package com.gfmaster.upload.storage;

import java.io.IOException;
import java.io.InputStream;
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

  /**
   * Nhận nội dung từ luồng (endpoint PUT của backend) mà không giữ cả file trong bộ nhớ: ghi tối đa
   * {@code maxBytes + 1} byte rồi dừng. Trả về số byte đã ghi; lớn hơn {@code maxBytes} nghĩa là file quá giới hạn
   * (người gọi xoá và báo 413). Driver không ghi được theo luồng thì đọc vào bộ nhớ (cùng giới hạn).
   */
  default long put(String key, InputStream in, long maxBytes, String contentType) throws IOException {
    byte[] content = in.readNBytes((int) Math.min(Integer.MAX_VALUE - 8, maxBytes + 1));
    put(key, content, contentType);
    return content.length;
  }

  byte[] get(String key);

  /** Kích thước file đã upload; rỗng nếu chưa có. */
  OptionalLong size(String key);

  void delete(String key);
}
