package com.gfmaster.upload;

import com.gfmaster.common.messaging.DomainEvent.UploadsDeleted;
import com.gfmaster.common.messaging.DomainEventPublisher;
import com.gfmaster.config.GfmProperties;
import com.gfmaster.upload.storage.IncomingStorage;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Ảnh mồ côi: người dùng chọn ảnh (đã upload) rồi huỷ form, hoặc đổi sang ảnh khác. Job xoá bản
 * ghi trong DB rồi phát {@code upload.deleted} để consumer xoá file.
 */
@Component
public class OrphanUploadCleanupJob {

  private static final Logger log = LoggerFactory.getLogger(OrphanUploadCleanupJob.class);
  static final int BATCH = 200;

  private final UploadRepository uploads;
  private final DomainEventPublisher events;
  private final TransactionTemplate tx;
  private final Duration olderThan;
  private final IncomingStorage incoming;
  static final Duration UNFINISHED_AFTER = Duration.ofDays(1);

  public OrphanUploadCleanupJob(
      UploadRepository uploads,
      DomainEventPublisher events,
      TransactionTemplate tx,
      GfmProperties props,
      IncomingStorage incoming) {
    this.uploads = uploads;
    this.events = events;
    this.tx = tx;
    this.olderThan = props.jobs().orphanUploads().olderThan();
    this.incoming = incoming;
  }

  @Scheduled(cron = "${gfm.jobs.orphan-uploads.cron}")
  @SchedulerLock(name = "orphan-upload-cleanup", lockAtLeastFor = "1m")
  public void run() {
    int total = cleanUp(Instant.now().minus(olderThan));
    int unfinished = cleanUnfinished(Instant.now().minus(UNFINISHED_AFTER));
    if (total + unfinished > 0) {
      log.info("Upload cleanup removed {} orphans, {} unfinished direct uploads", total, unfinished);
    }
  }

  /**
   * Upload thẳng bỏ dở quá 1 ngày (người dùng đóng tab trước khi gửi ảnh, worker lỗi hết lượt retry,
   * ảnh hỏng): xoá ảnh gốc trong vùng incoming và bản ghi. Không có file công khai nào để xoá.
   */
  int cleanUnfinished(Instant before) {
    List<Upload> stale =
        uploads.findUnfinished(
            List.of(UploadStatus.AWAITING_UPLOAD, UploadStatus.PROCESSING, UploadStatus.FAILED), before);
    for (Upload u : stale) {
      if (u.getIncomingKey() != null) incoming.delete(u.getIncomingKey());
    }
    tx.executeWithoutResult(status -> uploads.deleteAllInBatch(stale));
    return stale.size();
  }

  /** Xoá theo từng lô, mỗi lô một transaction; trả về tổng số upload đã xoá. */
  int cleanUp(Instant before) {
    int total = 0;
    int removed;
    do {
      removed = tx.execute(status -> cleanBatch(before));
      total += removed;
    } while (removed == BATCH);
    return total;
  }

  private int cleanBatch(Instant before) {
    List<Upload> orphans = uploads.findOrphans(before, BATCH);
    if (orphans.isEmpty()) return 0;
    uploads.deleteAllInBatch(orphans);
    // Một event cho mỗi user (header x-user-id), gửi sau khi lô này commit
    orphans.stream()
        .collect(Collectors.groupingBy(u -> u.getUser().getId()))
        .forEach((UUID userId, List<Upload> list) ->
            events.publish(
                new UploadsDeleted(userId, list.stream().flatMap(u -> UploadService.filesOf(u).stream()).toList())));
    return orphans.size();
  }
}
