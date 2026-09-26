package com.gfmaster.upload;

import com.gfmaster.common.security.CurrentUser;
import com.gfmaster.upload.dto.UploadResponse;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/uploads")
public class UploadController {

  private final UploadService service;

  public UploadController(UploadService service) {
    this.service = service;
  }

  @PostMapping(path = "/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ResponseEntity<UploadResponse> uploadImage(
      @CurrentUser UUID userId, @RequestParam("file") MultipartFile file) {
    return ResponseEntity.status(HttpStatus.CREATED).body(service.storeImage(userId, file));
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@CurrentUser UUID userId, @PathVariable UUID id) {
    service.delete(userId, id);
    return ResponseEntity.noContent().build();
  }
}
