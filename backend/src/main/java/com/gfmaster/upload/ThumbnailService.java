package com.gfmaster.upload;

import com.gfmaster.upload.ImageProcessor.ProcessedImage;
import com.gfmaster.upload.storage.StorageDriver;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Sinh thumbnail 320px cho một upload. Chạy nền, được gọi từ consumer của event image.uploaded. */
@Service
public class ThumbnailService {

  private static final Logger log = LoggerFactory.getLogger(ThumbnailService.class);

  private final UploadRepository uploads;
  private final StorageDriver storage;
  private final ImageProcessor processor;

  public ThumbnailService(UploadRepository uploads, StorageDriver storage, ImageProcessor processor) {
    this.uploads = uploads;
    this.storage = storage;
    this.processor = processor;
  }

  /**
   * Bỏ qua nếu upload đã bị xoá hoặc đã có thumbnail (message đến lần hai). Lỗi đọc/ghi file thì
   * ném ra để RabbitMQ retry, hết lượt thì message vào DLQ.
   */
  // REQUIRES_NEW: khi tắt RabbitMQ, hàm này chạy trong callback AFTER_COMMIT của request upload;
  // REQUIRED sẽ nhập vào transaction đã commit đó và thay đổi không bao giờ được ghi
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void generate(UUID uploadId) {
    Upload upload = uploads.findById(uploadId).orElse(null);
    if (upload == null || upload.getStatus() != UploadStatus.THUMB_PENDING) {
      log.debug("Skip thumbnail for upload {}: not pending", uploadId);
      return;
    }
    ProcessedImage thumb = processor.thumbnail(storage.get(upload.getStorageKey()));
    String url = storage.put(UploadService.thumbKeyOf(upload.getStorageKey()), thumb.bytes(), upload.getMimeType());
    upload.setThumbUrl(url);
    upload.setStatus(UploadStatus.READY);
  }
}
