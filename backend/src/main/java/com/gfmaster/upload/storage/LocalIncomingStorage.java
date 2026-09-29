package com.gfmaster.upload.storage;

import com.gfmaster.config.GfmProperties;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Optional;
import java.util.OptionalLong;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Ảnh gốc chờ xử lý, lưu ở {@code gfm.storage.local-incoming-dir}: thư mục <b>khác</b> thư mục được
 * phục vụ qua /uploads/**. Không có presigned URL: trình duyệt PUT vào
 * {@code /api/v1/uploads/{id}/content} của backend (cùng một luồng với S3 ở phía frontend).
 */
@Component
@ConditionalOnProperty(name = "gfm.storage.driver", havingValue = "local", matchIfMissing = true)
public class LocalIncomingStorage implements IncomingStorage {

  private final Path root;

  public LocalIncomingStorage(GfmProperties props) throws IOException {
    this.root = Path.of(props.storage().localIncomingDir()).toAbsolutePath().normalize();
    Files.createDirectories(root);
  }

  @Override
  public Optional<URI> presignPut(String key, String contentType, long contentLength, Duration ttl) {
    return Optional.empty();
  }

  @Override
  public void put(String key, byte[] content, String contentType) {
    Path target = resolve(key);
    try {
      Files.createDirectories(target.getParent());
      Files.write(target, content);
    } catch (IOException e) {
      throw new UncheckedIOException("Không ghi được file " + key, e);
    }
  }

  @Override
  public byte[] get(String key) {
    try {
      return Files.readAllBytes(resolve(key));
    } catch (IOException e) {
      throw new UncheckedIOException("Không đọc được file " + key, e);
    }
  }

  @Override
  public OptionalLong size(String key) {
    try {
      Path file = resolve(key);
      return Files.isRegularFile(file) ? OptionalLong.of(Files.size(file)) : OptionalLong.empty();
    } catch (IOException e) {
      throw new UncheckedIOException("Không đọc được file " + key, e);
    }
  }

  @Override
  public void delete(String key) {
    try {
      Files.deleteIfExists(resolve(key));
    } catch (IOException e) {
      throw new UncheckedIOException("Không xoá được file " + key, e);
    }
  }

  private Path resolve(String key) {
    Path target = root.resolve(key).normalize();
    if (!target.startsWith(root)) throw new IllegalArgumentException("Storage key không hợp lệ: " + key);
    return target;
  }
}
