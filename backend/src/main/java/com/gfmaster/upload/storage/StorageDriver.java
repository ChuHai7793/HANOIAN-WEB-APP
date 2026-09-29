package com.gfmaster.upload.storage;

/** Storage công khai (ảnh đã xử lý). Dev: thư mục local. Prod: S3-compatible (R2/S3/MinIO), xem S3Storage. */
public interface StorageDriver {

  /** Ghi file vào storage công khai, trả về dạng lưu DB {@code /uploads/<key>} (xem ImageUrls). */
  String put(String key, byte[] content, String contentType);

  /** Đọc lại nội dung file; không tồn tại thì ném {@link java.io.UncheckedIOException}. */
  byte[] get(String key);

  void delete(String key);

  boolean exists(String key);
}
