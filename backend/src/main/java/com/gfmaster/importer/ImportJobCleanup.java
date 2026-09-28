package com.gfmaster.importer;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Mỗi giờ: job kẹt quá 1 giờ thì FAILED; payload của job đã xong quá 3 ngày thì xoá. */
@Component
public class ImportJobCleanup {

  private static final Logger log = LoggerFactory.getLogger(ImportJobCleanup.class);
  static final Duration STUCK_AFTER = Duration.ofHours(1);
  static final Duration KEEP_PAYLOAD = Duration.ofDays(3);

  private final ImportJobRepository jobs;

  public ImportJobCleanup(ImportJobRepository jobs) {
    this.jobs = jobs;
  }

  @Scheduled(cron = "0 17 * * * *")
  @SchedulerLock(name = "import-job-cleanup", lockAtLeastFor = "1m")
  @Transactional
  public void run() {
    Instant now = Instant.now();
    int stuck =
        jobs.failStuck(
            List.of(ImportJobStatus.QUEUED, ImportJobStatus.RUNNING),
            now.minus(STUCK_AFTER),
            now,
            "Import bị gián đoạn, không có gì được lưu. Hãy thử lại.");
    int cleared = jobs.clearPayloadsFinishedBefore(now.minus(KEEP_PAYLOAD));
    if (stuck + cleared > 0) log.info("Import cleanup: {} stuck jobs failed, {} payloads cleared", stuck, cleared);
  }
}
