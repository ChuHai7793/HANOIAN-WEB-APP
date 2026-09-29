package com.gfmaster.upload;

/**
 * Upload thẳng: AWAITING_UPLOAD (đã phát URL, chờ trình duyệt PUT) → PROCESSING (worker đang xử lý)
 * → READY / FAILED. Upload qua backend (multipart, import): THUMB_PENDING → READY.
 */
public enum UploadStatus {
  AWAITING_UPLOAD,
  PROCESSING,
  READY,
  THUMB_PENDING,
  FAILED
}
