package com.gfmaster.importer;

import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.error.ErrorCode;
import com.gfmaster.common.security.CurrentUser;
import com.gfmaster.config.GfmProperties;
import com.gfmaster.importer.dto.ImportJobResponse;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/import")
public class ImportController {

  private final ImportService service;
  private final long maxBytes;

  public ImportController(ImportService service, GfmProperties props) {
    this.service = service;
    this.maxBytes = props.importer().maxSize().toBytes();
  }

  /** Body: {@code {places, girlfriends, placeLinks}} như localStorage cũ. Trả 202 + jobId, xử lý ở nền. */
  @PostMapping(path = "/local-storage", consumes = MediaType.APPLICATION_JSON_VALUE)
  public ResponseEntity<Map<String, UUID>> importLocalStorage(@CurrentUser UUID userId, HttpServletRequest request)
      throws IOException {
    UUID jobId = service.start(userId, readLimited(request));
    return ResponseEntity.accepted()
        .location(URI.create("/api/v1/import/jobs/" + jobId))
        .body(Map.of("jobId", jobId));
  }

  @GetMapping("/jobs/{id}")
  public ImportJobResponse job(@CurrentUser UUID userId, @PathVariable UUID id) {
    return service.get(userId, id);
  }

  /** Đọc tối đa maxBytes; không tin Content-Length (có thể thiếu hoặc sai) nên đếm khi đọc. */
  private String readLimited(HttpServletRequest request) throws IOException {
    if (request.getContentLengthLong() > maxBytes) throw tooLarge();
    try (InputStream in = request.getInputStream()) {
      byte[] body = in.readNBytes((int) maxBytes + 1);
      if (body.length > maxBytes) throw tooLarge();
      return new String(body, StandardCharsets.UTF_8);
    }
  }

  private ApiException tooLarge() {
    return new ApiException(
        ErrorCode.IMPORT_TOO_LARGE, "Dữ liệu import vượt quá " + (maxBytes / 1024 / 1024) + "MB.");
  }
}
