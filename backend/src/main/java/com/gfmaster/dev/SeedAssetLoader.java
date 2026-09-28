package com.gfmaster.dev;

import com.gfmaster.upload.ImageProcessor;
import com.gfmaster.upload.storage.StorageDriver;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Chỉ ở profile dev: nạp ảnh mẫu từ thư mục {@code backend/seed-assets/} vào storage dưới key
 * {@code seed/<tên file>.webp}, để R__demo_data.sql trỏ {@code image_url} vào
 * {@code /uploads/seed/...}. Ảnh đã có thì bỏ qua, nên khởi động lại không tốn thời gian.
 *
 * <p>Ảnh gốc nằm ngoài {@code src/main/resources} để không bị đóng gói vào file jar production.
 * Ảnh seed không có dòng trong bảng {@code uploads}, nên job dọn ảnh mồ côi không đụng tới.
 */
@Component
@Profile("dev")
public class SeedAssetLoader implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(SeedAssetLoader.class);

  private final StorageDriver storage;
  private final ImageProcessor processor;
  private final Path dir;

  public SeedAssetLoader(
      StorageDriver storage, ImageProcessor processor, @Value("${gfm.seed.assets-dir:./seed-assets}") Path dir) {
    this.storage = storage;
    this.processor = processor;
    this.dir = dir;
  }

  /** {@code Chaly-Cuccu.png} → {@code seed/chaly-cuccu.webp} */
  static String keyOf(Path file) {
    String name = file.getFileName().toString();
    return "seed/" + name.substring(0, name.lastIndexOf('.')).toLowerCase() + ".webp";
  }

  @Override
  public void run(ApplicationArguments args) throws IOException {
    if (!Files.isDirectory(dir)) {
      log.warn("Seed assets dir {} not found, demo places will have no images", dir.toAbsolutePath());
      return;
    }
    List<Path> images;
    try (Stream<Path> files = Files.walk(dir)) {
      images = files.filter(Files::isRegularFile).filter(SeedAssetLoader::isImage).sorted().toList();
    }
    int loaded = 0;
    for (Path file : images) {
      String key = keyOf(file);
      if (storage.exists(key)) continue;
      storage.put(key, processor.process(Files.readAllBytes(file)).bytes(), "image/webp");
      loaded++;
    }
    log.info("Seed assets: {} loaded, {} already present", loaded, images.size() - loaded);
  }

  private static boolean isImage(Path file) {
    String name = file.getFileName().toString().toLowerCase();
    return name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".webp");
  }
}
