package com.gfmaster.upload;

import com.gfmaster.common.security.CurrentUser;
import com.gfmaster.common.security.DataOwner;
import com.gfmaster.upload.dto.DirectUploadResponse;
import com.gfmaster.upload.dto.UploadResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import java.io.IOException;
import java.io.InputStream;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Upload thẳng lên storage (frontend dùng):
 *
 * <ol>
 *   <li>{@code POST /uploads/direct {contentType, sizeBytes}} → 201 {@code {id, uploadUrl, method,
 *       headers}}
 *   <li>Trình duyệt {@code PUT uploadUrl} (presigned URL của S3/R2; với driver local là {@code PUT
 *       /uploads/{id}/content})
 *   <li>{@code POST /uploads/{id}/complete} → 202, worker xử lý ở nền
 *   <li>{@code GET /uploads/{id}} tới khi {@code status} là READY (có {@code url}) hoặc FAILED
 * </ol>
 *
 * <p>Bốn bước trên gắn upload với người đang đăng nhập ({@code @CurrentUser}): guest cũng upload
 * được ảnh đại diện của mình. Với admin, người đăng nhập chính là chủ dữ liệu nên không đổi gì.
 *
 * <p>{@code POST /uploads/image} (multipart, xử lý ngay trong request) vẫn giữ cho client cũ.
 */
@RestController
@RequestMapping("/api/v1/uploads")
public class UploadController {

  private final UploadService service;

  public UploadController(UploadService service) {
    this.service = service;
  }

  public record DirectUploadRequest(@NotBlank String contentType, @Positive long sizeBytes) {}

  @PostMapping("/direct")
  public ResponseEntity<DirectUploadResponse> beginDirect(
      @CurrentUser UUID userId, @Valid @RequestBody DirectUploadRequest request) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(service.beginDirect(userId, request.contentType(), request.sizeBytes()));
  }

  /** Chỉ dùng với driver local (thay cho presigned URL của S3). */
  @PutMapping("/{id}/content")
  public ResponseEntity<Void> content(@CurrentUser UUID userId, @PathVariable UUID id, HttpServletRequest request)
      throws IOException {
    try (InputStream in = request.getInputStream()) {
      // Đọc tối đa giới hạn + 1 byte: đủ để biết file lớn hơn giới hạn (service báo 413) mà không đọc hết
      service.receiveContent(userId, id, in.readNBytes((int) service.maxUploadBytes() + 1));
    }
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/{id}/complete")
  public ResponseEntity<UploadResponse> complete(@CurrentUser UUID userId, @PathVariable UUID id) {
    return ResponseEntity.status(HttpStatus.ACCEPTED).body(service.completeDirect(userId, id));
  }

  @GetMapping("/{id}")
  public UploadResponse get(@CurrentUser UUID userId, @PathVariable UUID id) {
    return service.get(userId, id);
  }

  @PostMapping(path = "/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ResponseEntity<UploadResponse> uploadImage(
      @DataOwner UUID userId, @RequestParam("file") MultipartFile file) {
    return ResponseEntity.status(HttpStatus.CREATED).body(service.storeImage(userId, file));
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@DataOwner UUID userId, @PathVariable UUID id) {
    service.delete(userId, id);
    return ResponseEntity.noContent().build();
  }
}
