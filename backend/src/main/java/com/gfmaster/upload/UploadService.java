package com.gfmaster.upload;

import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.error.ErrorCode;
import com.gfmaster.common.messaging.DomainEvent.ImageReceived;
import com.gfmaster.common.messaging.DomainEvent.ImageUploaded;
import com.gfmaster.common.messaging.DomainEvent.UploadsDeleted;
import com.gfmaster.common.messaging.DomainEventPublisher;
import com.gfmaster.config.GfmProperties;
import com.gfmaster.upload.ImageProcessor.ProcessedImage;
import com.gfmaster.upload.dto.DirectUploadResponse;
import com.gfmaster.upload.dto.UploadResponse;
import com.gfmaster.upload.storage.ImageUrls;
import com.gfmaster.upload.storage.IncomingStorage;
import com.gfmaster.upload.storage.StorageDriver;
import com.gfmaster.user.UserRepository;
import java.io.IOException;
import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.OptionalLong;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

/**
 * Hai cách đưa ảnh lên:
 *
 * <ul>
 *   <li><b>Upload thẳng lên storage</b> (frontend dùng cách này): {@link #beginDirect} tạo bản ghi
 *       AWAITING_UPLOAD và phát URL để trình duyệt PUT ảnh gốc vào vùng incoming (riêng tư) →
 *       {@link #completeDirect} chuyển PROCESSING và phát {@code image.received} → worker
 *       ({@link ImageIntakeService}) xử lý, lưu vào storage công khai, READY. WebP trình duyệt đã nén
 *       sạch thì lưu luôn trong request ({@link #completeDirect}), thumbnail sinh ở nền.
 *   <li><b>Qua backend</b> ({@link #storeImage}): multipart cũ và import dữ liệu cũ. Xử lý ngay trong
 *       request, thumbnail sinh ở nền.
 * </ul>
 */
@Service
public class UploadService {

  static final String WEBP = "image/webp";
  static final Set<String> ACCEPTED_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
  static final Duration UPLOAD_URL_TTL = Duration.ofMinutes(15);

  private final ImageProcessor processor;
  private final StorageDriver storage;
  private final IncomingStorage incoming;
  private final UploadRepository uploads;
  private final UserRepository users;
  private final DomainEventPublisher events;
  private final ImageUrls imageUrls;
  private final long maxBytes;

  public UploadService(
      ImageProcessor processor,
      StorageDriver storage,
      IncomingStorage incoming,
      UploadRepository uploads,
      UserRepository users,
      DomainEventPublisher events,
      ImageUrls imageUrls,
      GfmProperties props) {
    this.processor = processor;
    this.storage = storage;
    this.incoming = incoming;
    this.uploads = uploads;
    this.users = users;
    this.events = events;
    this.imageUrls = imageUrls;
    this.maxBytes = props.storage().maxUploadSize().toBytes();
  }

  public long maxUploadBytes() {
    return maxBytes;
  }

  /** Thumbnail nằm cạnh ảnh gốc: {@code .../abc.webp} → {@code .../abc-320.webp}. */
  static String thumbKeyOf(String storageKey) {
    return storageKey.replaceFirst("\\.webp$", "-320.webp");
  }

  /** Bản 800px cho thẻ: {@code .../abc.webp} → {@code .../abc-800.webp} (frontend tự suy ra từ URL, không lưu DB). */
  static String cardKeyOf(String storageKey) {
    return storageKey.replaceFirst("\\.webp$", "-800.webp");
  }

  /** Mọi file công khai của một upload (ảnh + hai bản nhỏ), dùng khi xoá. Chưa xử lý xong thì rỗng. */
  static List<String> filesOf(Upload upload) {
    if (upload.getStorageKey() == null) return List.of();
    return List.of(upload.getStorageKey(), thumbKeyOf(upload.getStorageKey()), cardKeyOf(upload.getStorageKey()));
  }

  /** Tên file trên storage công khai theo loại ảnh và tên gợi ý của upload (xem {@link ImageKeys}). */
  static String keyFor(Upload upload) {
    return ImageKeys.newPublicKey(ImagePurpose.parse(upload.getPurpose()), upload.getNameHint());
  }

  /** Tên gợi ý gọn lại cho cột name_hint (80 ký tự); rỗng thì null. */
  static String hint(String name) {
    if (name == null || name.isBlank()) return null;
    String s = name.strip();
    return s.length() > 80 ? s.substring(0, 80) : s;
  }

  // ---- Upload thẳng lên storage ----

  /**
   * Bước 1: kiểm tra loại và kích thước khai báo, tạo bản ghi, trả URL để PUT. Với S3 là presigned
   * URL (Content-Type và Content-Length nằm trong chữ ký); với driver local là endpoint của backend.
   */
  @Transactional
  public DirectUploadResponse beginDirect(UUID userId, String contentType, long sizeBytes) {
    return beginDirect(userId, contentType, sizeBytes, null, null);
  }

  /**
   * @param purpose loại ảnh (place, spot, avatar, dating, girlfriend), quyết định thư mục
   * @param name tên gợi ý cho file (tên quán, tên người…), có thể null
   */
  @Transactional
  public DirectUploadResponse beginDirect(UUID userId, String contentType, long sizeBytes, String purpose, String name) {
    String type = contentType == null ? "" : contentType.trim().toLowerCase();
    if (!ACCEPTED_TYPES.contains(type)) throw new ApiException(ErrorCode.UNSUPPORTED_IMAGE);
    if (sizeBytes <= 0 || sizeBytes > maxBytes) throw tooLarge();

    Upload upload = new Upload();
    upload.setUser(users.getReferenceById(userId));
    upload.setIncomingKey("%s/%s".formatted(userId, UUID.randomUUID()));
    upload.setPurpose(ImagePurpose.parse(purpose).name());
    upload.setNameHint(hint(name));
    upload.setMimeType(type);
    upload.setSizeBytes((int) sizeBytes);
    upload.setStatus(UploadStatus.AWAITING_UPLOAD);
    Upload saved = uploads.saveAndFlush(upload);

    String url =
        incoming
            .presignPut(saved.getIncomingKey(), type, sizeBytes, UPLOAD_URL_TTL)
            .map(URI::toString)
            .orElse("/api/v1/uploads/" + saved.getId() + "/content");
    return new DirectUploadResponse(
        saved.getId(), url, "PUT", Map.of("Content-Type", type), Instant.now().plus(UPLOAD_URL_TTL));
  }

  /** Bước 2 khi dùng driver local: backend nhận nội dung thay cho storage. */
  @Transactional(readOnly = true)
  public void receiveContent(UUID userId, UUID id, byte[] content) {
    Upload upload = load(userId, id);
    if (upload.getStatus() != UploadStatus.AWAITING_UPLOAD) {
      throw new ApiException(ErrorCode.DATA_CONFLICT, "Ảnh này đã được gửi rồi.");
    }
    if (content.length == 0) throw new ApiException(ErrorCode.UNSUPPORTED_IMAGE, "File rỗng.");
    if (content.length > maxBytes) throw tooLarge();
    incoming.put(upload.getIncomingKey(), content, upload.getMimeType());
  }

  /** Bước 3: trình duyệt báo đã PUT xong → kiểm tra file có thật, giao cho worker xử lý. */
  @Transactional
  public UploadResponse completeDirect(UUID userId, UUID id) {
    Upload upload = load(userId, id);
    if (upload.getStatus() != UploadStatus.AWAITING_UPLOAD) return toResponse(upload); // gọi lại: trả trạng thái
    OptionalLong size = incoming.size(upload.getIncomingKey());
    if (size.isEmpty()) throw new ApiException(ErrorCode.UPLOAD_NOT_RECEIVED);
    if (size.getAsLong() > maxBytes) {
      upload.setStatus(UploadStatus.FAILED);
      deleteIncomingAfterCommit(upload.getIncomingKey());
      throw tooLarge();
    }
    if (WEBP.equals(upload.getMimeType()) && acceptAsIs(upload)) return toResponse(upload);
    upload.setStatus(UploadStatus.PROCESSING);
    events.publish(new ImageReceived(userId, upload.getId()));
    return toResponse(upload);
  }

  /**
   * Đường tắt: ảnh trình duyệt đã nén sẵn thành WebP sạch, đủ nhỏ ({@link WebpInspector}) thì lưu nguyên
   * trạng sang storage công khai ngay trong request, không giải mã / nén lại; thumbnail sinh ở nền
   * (THUMB_PENDING → READY). Trình duyệt nhận URL luôn, không phải chờ worker.
   *
   * @return false nếu ảnh cần xử lý đầy đủ
   */
  private boolean acceptAsIs(Upload upload) {
    byte[] raw = incoming.get(upload.getIncomingKey());
    var size = WebpInspector.inspect(raw);
    if (size.isEmpty()) return false;

    String key = keyFor(upload);
    upload.setUrl(storage.put(key, raw, WEBP));
    deletePublicIfRolledBack(key);
    upload.setStorageKey(key);
    upload.setSizeBytes(raw.length);
    upload.setWidth(size.get().width());
    upload.setHeight(size.get().height());
    upload.setStatus(UploadStatus.THUMB_PENDING);
    deleteIncomingAfterCommit(upload.getIncomingKey());
    upload.setIncomingKey(null);
    events.publish(new ImageUploaded(upload.getUser().getId(), upload.getId()));
    return true;
  }

  @Transactional(readOnly = true)
  public UploadResponse get(UUID userId, UUID id) {
    return toResponse(load(userId, id));
  }

  // ---- Qua backend ----

  @Transactional
  public UploadResponse storeImage(UUID userId, MultipartFile file) {
    return storeImage(userId, file, null, null);
  }

  @Transactional
  public UploadResponse storeImage(UUID userId, MultipartFile file, String purpose, String name) {
    if (file == null || file.isEmpty()) {
      throw new ApiException(ErrorCode.UNSUPPORTED_IMAGE, "Chưa chọn file ảnh.");
    }
    try {
      return storeImage(userId, file.getBytes(), purpose, name);
    } catch (IOException e) {
      throw new ApiException(ErrorCode.UNSUPPORTED_IMAGE, "Không đọc được file ảnh này.");
    }
  }

  /** Dùng chung cho upload multipart và import dữ liệu cũ (ảnh data: URL đã decode). */
  @Transactional
  public UploadResponse storeImage(UUID userId, byte[] raw) {
    return storeImage(userId, raw, null, null);
  }

  @Transactional
  public UploadResponse storeImage(UUID userId, byte[] raw, String purpose, String name) {
    ProcessedImage image = processor.process(raw);
    Upload upload = new Upload();
    upload.setPurpose(ImagePurpose.parse(purpose).name());
    upload.setNameHint(hint(name));
    String key = keyFor(upload);
    String url = storage.put(key, image.bytes(), WEBP);
    deletePublicIfRolledBack(key);

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
    Upload upload = load(userId, id);
    uploads.delete(upload);
    // File xoá sau commit: transaction rollback thì file vẫn còn, không có bản ghi trỏ vào file đã mất
    List<String> files = filesOf(upload);
    if (!files.isEmpty()) events.publish(new UploadsDeleted(userId, files));
    if (upload.getIncomingKey() != null) deleteIncomingAfterCommit(upload.getIncomingKey());
  }

  UploadResponse toResponse(Upload u) {
    return new UploadResponse(
        u.getId(),
        imageUrls.toPublic(u.getUrl()),
        imageUrls.toPublic(u.getThumbUrl()),
        u.getWidth(),
        u.getHeight(),
        u.getSizeBytes(),
        u.getStatus());
  }

  private Upload load(UUID userId, UUID id) {
    return uploads.findByIdAndUserId(id, userId).orElseThrow(ApiException::notFound);
  }

  private ApiException tooLarge() {
    return new ApiException(ErrorCode.FILE_TOO_LARGE, "Ảnh tối đa " + (maxBytes / 1024 / 1024) + "MB.");
  }

  /**
   * Ghi file không nằm trong transaction DB: nếu transaction rollback (ví dụ import lỗi giữa
   * chừng) thì file vừa ghi không có bản ghi nào trỏ tới, job dọn ảnh mồ côi cũng không thấy. Xoá
   * ngay khi biết đã rollback.
   */
  void deletePublicIfRolledBack(String key) {
    if (!TransactionSynchronizationManager.isSynchronizationActive()) return;
    TransactionSynchronizationManager.registerSynchronization(
        new TransactionSynchronization() {
          @Override
          public void afterCompletion(int status) {
            if (status == STATUS_ROLLED_BACK) storage.delete(key);
          }
        });
  }

  /** Ảnh gốc chỉ xoá khi DB đã commit trạng thái mới (lỗi thì còn để xử lý lại). */
  void deleteIncomingAfterCommit(String key) {
    if (!TransactionSynchronizationManager.isSynchronizationActive()) {
      incoming.delete(key);
      return;
    }
    TransactionSynchronizationManager.registerSynchronization(
        new TransactionSynchronization() {
          @Override
          public void afterCommit() {
            incoming.delete(key);
          }
        });
  }
}
