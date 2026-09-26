package com.gfmaster.upload.storage;

/** Nơi lưu file ảnh. Dev: thư mục local. Prod: S3-compatible (R2/MinIO), thêm ở Phase 10. */
public interface StorageDriver {

  /** Ghi file và trả về URL công khai (ví dụ {@code /uploads/<key>}). */
  String put(String key, byte[] content, String contentType);

  void delete(String key);
}
