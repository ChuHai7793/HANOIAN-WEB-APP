package com.gfmaster.upload;

import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.error.ErrorCode;
import com.gfmaster.upload.ImageProcessor.ProcessedImage;
import com.gfmaster.upload.dto.UploadResponse;
import com.gfmaster.upload.storage.StorageDriver;
import com.gfmaster.user.UserRepository;
import java.io.IOException;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * Upload đồng bộ: xử lý ảnh, lưu storage, ghi bảng {@code uploads}.
 *
 * <p>TODO(Phase 6): publish {@code image.uploaded} để consumer sinh thumbnail 320px; xoá file qua
 * event {@code upload.deleted}; job dọn ảnh mồ côi.
 */
@Service
public class UploadService {

  private static final String WEBP = "image/webp";

  private final ImageProcessor processor;
  private final StorageDriver storage;
  private final UploadRepository uploads;
  private final UserRepository users;

  public UploadService(
      ImageProcessor processor, StorageDriver storage, UploadRepository uploads, UserRepository users) {
    this.processor = processor;
    this.storage = storage;
    this.uploads = uploads;
    this.users = users;
  }

  @Transactional
  public UploadResponse storeImage(UUID userId, MultipartFile file) {
    if (file == null || file.isEmpty()) {
      throw new ApiException(ErrorCode.UNSUPPORTED_IMAGE, "Chưa chọn file ảnh.");
    }
    ProcessedImage image;
    try {
      image = processor.process(file.getBytes());
    } catch (IOException e) {
      throw new ApiException(ErrorCode.UNSUPPORTED_IMAGE, "Không đọc được file ảnh này.");
    }

    // Tên file do server sinh: {userId}/{yyyy}/{MM}/{uuid}.webp
    LocalDate today = LocalDate.now();
    String key =
        "%s/%d/%02d/%s.webp".formatted(userId, today.getYear(), today.getMonthValue(), UUID.randomUUID());
    String url = storage.put(key, image.bytes(), WEBP);

    Upload upload = new Upload();
    upload.setUser(users.getReferenceById(userId));
    upload.setStorageKey(key);
    upload.setUrl(url);
    upload.setMimeType(WEBP);
    upload.setSizeBytes(image.bytes().length);
    upload.setWidth(image.width());
    upload.setHeight(image.height());
    upload.setStatus(UploadStatus.READY);
    return toResponse(uploads.saveAndFlush(upload));
  }

  @Transactional
  public void delete(UUID userId, UUID id) {
    Upload upload = uploads.findByIdAndUserId(id, userId).orElseThrow(ApiException::notFound);
    uploads.delete(upload);
    storage.delete(upload.getStorageKey());
  }

  private static UploadResponse toResponse(Upload u) {
    return new UploadResponse(
        u.getId(), u.getUrl(), u.getThumbUrl(), u.getWidth(), u.getHeight(), u.getSizeBytes(), u.getStatus());
  }
}
