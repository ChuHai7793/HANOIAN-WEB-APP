package com.gfmaster.upload;

import com.gfmaster.common.error.ApiException;
import com.gfmaster.upload.ImageProcessor.ProcessedImage;
import com.gfmaster.upload.storage.IncomingStorage;
import com.gfmaster.upload.storage.StorageDriver;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Worker của upload thẳng (event {@code image.received}): ảnh gốc trong vùng incoming → kiểm tra
 * magic bytes, xoay EXIF, thu về 1200px, WebP, bỏ metadata (GPS...) → lưu vào storage công khai cùng
 * thumbnail 320px → READY, xoá ảnh gốc.
 *
 * <p>File không phải ảnh (đổi đuôi, hỏng) thì FAILED và xoá luôn. Lỗi đọc/ghi storage thì ném ra để
 * RabbitMQ retry, hết lượt thì message vào DLQ, bản ghi vẫn PROCESSING tới khi job dọn dẹp xử lý.
 */
@Service
public class ImageIntakeService {

  private static final Logger log = LoggerFactory.getLogger(ImageIntakeService.class);

  private final UploadRepository uploads;
  private final IncomingStorage incoming;
  private final StorageDriver storage;
  private final ImageProcessor processor;
  private final UploadService uploadService;

  public ImageIntakeService(
      UploadRepository uploads,
      IncomingStorage incoming,
      StorageDriver storage,
      ImageProcessor processor,
      UploadService uploadService) {
    this.uploads = uploads;
    this.incoming = incoming;
    this.storage = storage;
    this.processor = processor;
    this.uploadService = uploadService;
  }

  // REQUIRES_NEW: khi tắt RabbitMQ, hàm này chạy trong callback AFTER_COMMIT (xem ThumbnailService)
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void process(UUID uploadId) {
    Upload upload = uploads.findById(uploadId).orElse(null);
    if (upload == null || upload.getStatus() != UploadStatus.PROCESSING) {
      log.debug("Skip intake for upload {}: not processing", uploadId);
      return;
    }
    String incomingKey = upload.getIncomingKey();
    byte[] raw = incoming.get(incomingKey);

    ProcessedImage image;
    ProcessedImage thumb;
    try {
      image = processor.process(raw);
      thumb = processor.thumbnail(image.bytes());
    } catch (ApiException e) {
      // Không phải ảnh JPEG/PNG/WebP thật: không retry, báo FAILED cho trình duyệt
      log.info("Upload {} rejected: {}", uploadId, e.getMessage());
      upload.setStatus(UploadStatus.FAILED);
      upload.setIncomingKey(null);
      uploadService.deleteIncomingAfterCommit(incomingKey);
      return;
    }

    String key = UploadService.newPublicKey(upload.getUser().getId());
    String thumbKey = UploadService.thumbKeyOf(key);
    upload.setUrl(storage.put(key, image.bytes(), UploadService.WEBP));
    uploadService.deletePublicIfRolledBack(key);
    upload.setThumbUrl(storage.put(thumbKey, thumb.bytes(), UploadService.WEBP));
    uploadService.deletePublicIfRolledBack(thumbKey);

    upload.setStorageKey(key);
    upload.setMimeType(UploadService.WEBP);
    upload.setSizeBytes(image.bytes().length);
    upload.setWidth(image.width());
    upload.setHeight(image.height());
    upload.setStatus(UploadStatus.READY);
    upload.setIncomingKey(null);
    uploadService.deleteIncomingAfterCommit(incomingKey);
  }
}
