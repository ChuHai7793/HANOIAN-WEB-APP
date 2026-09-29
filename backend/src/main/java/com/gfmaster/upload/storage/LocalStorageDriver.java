package com.gfmaster.upload.storage;

import com.gfmaster.config.GfmProperties;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Lưu file vào {@code gfm.storage.local-dir}; Spring MVC phục vụ lại qua {@code /uploads/**}. */
@Component
@ConditionalOnProperty(name = "gfm.storage.driver", havingValue = "local", matchIfMissing = true)
public class LocalStorageDriver implements StorageDriver {

  private final Path root;

  public LocalStorageDriver(GfmProperties props) throws IOException {
    this.root = Path.of(props.storage().localDir()).toAbsolutePath().normalize();
    Files.createDirectories(root);
  }

  public Path root() {
    return root;
  }

  @Override
  public String put(String key, byte[] content, String contentType) {
    Path target = resolve(key);
    try {
      Files.createDirectories(target.getParent());
      Files.write(target, content);
    } catch (IOException e) {
      throw new UncheckedIOException("Không ghi được file " + key, e);
    }
    return ImageUrls.stored(key);
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
  public void delete(String key) {
    try {
      Files.deleteIfExists(resolve(key));
    } catch (IOException e) {
      throw new UncheckedIOException("Không xoá được file " + key, e);
    }
  }

  @Override
  public boolean exists(String key) {
    return Files.isRegularFile(resolve(key));
  }

  /** Chặn path traversal: key không được thoát ra ngoài thư mục gốc. */
  private Path resolve(String key) {
    Path target = root.resolve(key).normalize();
    if (!target.startsWith(root)) {
      throw new IllegalArgumentException("Storage key không hợp lệ: " + key);
    }
    return target;
  }
}
