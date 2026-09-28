package com.gfmaster.upload;

import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.error.ErrorCode;
import com.gfmaster.common.messaging.DomainEvent.ImageUploaded;
import com.gfmaster.common.messaging.DomainEvent.UploadsDeleted;
import com.gfmaster.common.messaging.DomainEventPublisher;
import com.gfmaster.upload.ImageProcessor.ProcessedImage;
import com.gfmaster.upload.dto.UploadResponse;
import com.gfmaster.upload.storage.StorageDriver;
import com.gfmaster.user.UserRepository;
import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

/**
 * Phần đồng bộ: xử lý ảnh, lưu storage, ghi bảng {@code uploads} với status THUMB_PENDING. Phần bất
 * đồng bộ (sau commit, qua RabbitMQ): sinh thumbnail ({@link ThumbnailService}), xoá file khi xoá
 * upload.
 */
@Service
public class UploadService {

  private static final String WEBP = "image/webp";

  private final ImageProcessor processor;
  private final StorageDriver storage;
  private final UploadRepository uploads;
  private final UserRepository users;
  private final DomainEventPublisher events;

  public UploadService(
      ImageProcessor processor,
      StorageDriver storage,
      UploadRepository uploads,
      UserRepository users,
      DomainEventPublisher events) {
    this.processor = processor;
    this.storage = storage;
    this.uploads = uploads;
    this.users = users;
    this.events = events;
  }

  /** Thumbnail nằm cạnh ảnh gốc: {@code .../abc.webp} → {@code .../abc-320.webp}. */
  static String thumbKeyOf(String storageKey) {
    return storageKey.replaceFirst("\\.webp$", "-320.webp");
  }

  /** Mọi file của một upload (ảnh gốc + thumbnail nếu đã sinh), dùng khi xoá. */
  static List<String> filesOf(Upload upload) {
    return List.of(upload.getStorageKey(), thumbKeyOf(upload.getStorageKey()));
  }

  @Transactional
  public UploadResponse storeImage(UUID userId, MultipartFile file) {
    if (file == null || file.isEmpty()) {
      throw new ApiException(ErrorCode.UNSUPPORTED_IMAGE, "Chưa chọn file ảnh.");
    }
    try {
      return storeImage(userId, file.getBytes());
    } catch (IOException e) {
      throw new ApiException(ErrorCode.UNSUPPORTED_IMAGE, "Không đọc được file ảnh này.");
    }
  }

  /** Dùng chung cho upload qua API và import dữ liệu cũ (ảnh data: URL đã decode). */
  @Transactional
  public UploadResponse storeImage(UUID userId, byte[] raw) {
    ProcessedImage image = processor.process(raw);

    // Tên file do server sinh: {userId}/{yyyy}/{MM}/{uuid}.webp
    LocalDate today = LocalDate.now();
    String key =
        "%s/%d/%02d/%s.webp".formatted(userId, today.getYear(), today.getMonthValue(), UUID.randomUUID());
    String url = storage.put(key, image.bytes(), WEBP);
    deleteFileIfRolledBack(key);

    Upload upload = new Upload();
    upload.setUser(users.getReferenceById(userId));
    upload.setStorageKey(key);
    upload.setUrl(url);
    upload.setMimeType(WEBP);
    upload.setSizeBytes(image.bytes().length);
    upload.setWidth(image.width());
    upload.setHeight(image.height());
    upload.setStatus(UploadStatus.THUMB_PENDING);
    Upload saved = uploads.saveAndFlush(upload);
    events.publish(new ImageUploaded(userId, saved.getId()));
    return toResponse(saved);
  }

  @Transactional
  public void delete(UUID userId, UUID id) {
    Upload upload = uploads.findByIdAndUserId(id, userId).orElseThrow(ApiException::notFound);
    uploads.delete(upload);
    // File xoá sau commit: transaction rollback thì file vẫn còn, không có bản ghi trỏ vào file đã mất
    events.publish(new UploadsDeleted(userId, filesOf(upload)));
  }

  /**
   * Ghi file không nằm trong transaction DB: nếu transaction rollback (ví dụ import lỗi giữa
   * chừng) thì file vừa ghi không có bản ghi nào trỏ tới, job dọn ảnh mồ côi cũng không thấy. Xoá
   * ngay khi biết đã rollback.
   */
  private void deleteFileIfRolledBack(String key) {
    if (!TransactionSynchronizationManager.isSynchronizationActive()) return;
    TransactionSynchronizationManager.registerSynchronization(
        new TransactionSynchronization() {
          @Override
          public void afterCompletion(int status) {
            if (status == STATUS_ROLLED_BACK) storage.delete(key);
          }
        });
  }

  private static UploadResponse toResponse(Upload u) {
    return new UploadResponse(
        u.getId(), u.getUrl(), u.getThumbUrl(), u.getWidth(), u.getHeight(), u.getSizeBytes(), u.getStatus());
  }
}
