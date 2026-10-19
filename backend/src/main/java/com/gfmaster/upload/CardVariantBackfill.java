package com.gfmaster.upload;

import com.gfmaster.upload.ImageProcessor.ProcessedImage;
import com.gfmaster.upload.storage.StorageDriver;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Sinh bù bản 800px cho ảnh tải lên trước khi có bản này. Duyệt upload đã READY theo thứ tự cũ trước, bỏ qua ảnh
 * đã có file {@code -800.webp}; mỗi lần gọi sinh tối đa {@code limit} ảnh (admin gọi lại tới khi không còn).
 * Ảnh gốc không còn trên storage (đã xoá tay) thì ghi nhận vào {@code missing}, không dừng cả đợt.
 */
@Service
public class CardVariantBackfill {

  private static final Logger log = LoggerFactory.getLogger(CardVariantBackfill.class);
  /** Mỗi trang đọc từ DB; nhỏ để không giữ nhiều bản ghi trong bộ nhớ */
  private static final int PAGE = 200;

  /** {@code scanned}: số upload đã xét; {@code generated}: số bản 800px vừa sinh; {@code missing}: ảnh gốc không còn */
  public record BackfillReport(int scanned, int generated, int skipped, List<String> missing) {}

  private final UploadRepository uploads;
  private final StorageDriver storage;
  private final ImageProcessor processor;

  public CardVariantBackfill(UploadRepository uploads, StorageDriver storage, ImageProcessor processor) {
    this.uploads = uploads;
    this.storage = storage;
    this.processor = processor;
  }

  @Transactional(readOnly = true)
  public BackfillReport run(int limit) {
    int scanned = 0;
    int generated = 0;
    int skipped = 0;
    List<String> missing = new ArrayList<>();
    for (int page = 0; generated < limit; page++) {
      List<Upload> batch = uploads.findReady(PageRequest.of(page, PAGE));
      if (batch.isEmpty()) break;
      for (Upload upload : batch) {
        if (generated >= limit) break;
        scanned++;
        String key = upload.getStorageKey();
        String cardKey = UploadService.cardKeyOf(key);
        if (cardKey.equals(key) || storage.exists(cardKey)) {
          skipped++;
          continue;
        }
        if (!storage.exists(key)) {
          missing.add(key);
          continue;
        }
        try {
          ProcessedImage card = processor.card(storage.get(key));
          storage.put(cardKey, card.bytes(), UploadService.WEBP);
          generated++;
        } catch (RuntimeException e) {
          log.warn("Không sinh được bản 800px cho {}: {}", key, e.getMessage());
          missing.add(key);
        }
      }
    }
    log.info("Card variants: scanned={} generated={} skipped={} missing={}", scanned, generated, skipped, missing.size());
    return new BackfillReport(scanned, generated, skipped, missing);
  }
}
