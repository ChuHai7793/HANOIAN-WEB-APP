package com.gfmaster.importer;

import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.error.ErrorCode;
import com.gfmaster.common.messaging.DomainEvent.EntityChanged;
import com.gfmaster.common.messaging.DomainEvent.EntityChanged.Action;
import com.gfmaster.common.messaging.DomainEvent.EntityChanged.Entity;
import com.gfmaster.common.messaging.DomainEvent.ImportRequested;
import com.gfmaster.common.messaging.DomainEventPublisher;
import com.gfmaster.importer.LegacyImporter.Stats;
import com.gfmaster.importer.dto.ImportJobResponse;
import com.gfmaster.importer.dto.LegacyExport;
import com.gfmaster.user.UserRepository;
import java.time.Instant;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/**
 * Import dữ liệu localStorage cũ, bất đồng bộ:
 *
 * <ol>
 *   <li>{@link #start}: kiểm tra JSON, lấy khoá {@code lock:import:{userId}} (không được thì 423),
 *       lưu job QUEUED kèm payload, phát {@code import.requested}; request trả 202 ngay.
 *   <li>{@link #run} (consumer): RUNNING → nhập toàn bộ trong <b>một</b> transaction, đánh dấu DONE
 *       trong chính transaction đó → nhả khoá. Lỗi thì rollback và đánh dấu FAILED.
 * </ol>
 *
 * <p>DONE được ghi cùng transaction với dữ liệu nhập, nên nếu message bị giao lại (at-least-once)
 * thì job hoặc đã DONE (bỏ qua), hoặc chưa có gì được lưu (chạy lại an toàn).
 */
@Service
public class ImportService {

  private static final Logger log = LoggerFactory.getLogger(ImportService.class);

  private final ImportJobRepository jobs;
  private final UserRepository users;
  private final ImportLock lock;
  private final LegacyImporter importer;
  private final DomainEventPublisher events;
  private final TransactionTemplate tx;
  /**
   * Cho {@link #run}: luôn mở transaction mới. Khi tắt RabbitMQ, run() chạy trong callback
   * AFTER_COMMIT của request; REQUIRED sẽ nhập vào transaction đã commit và không lưu gì.
   */
  private final TransactionTemplate newTx;
  private final JsonMapper json;

  public ImportService(
      ImportJobRepository jobs,
      UserRepository users,
      ImportLock lock,
      LegacyImporter importer,
      DomainEventPublisher events,
      PlatformTransactionManager txManager,
      JsonMapper json) {
    this.jobs = jobs;
    this.users = users;
    this.lock = lock;
    this.importer = importer;
    this.events = events;
    this.tx = new TransactionTemplate(txManager);
    this.newTx = new TransactionTemplate(txManager);
    this.newTx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    this.json = json;
  }

  public UUID start(UUID userId, String payload) {
    LegacyExport export = parse(payload);
    if (export.size() == 0) {
      throw new ApiException(ErrorCode.VALIDATION_FAILED, "Không có dữ liệu nào để import.");
    }
    String token = lock.tryAcquire(userId);
    if (token == null) throw new ApiException(ErrorCode.IMPORT_RUNNING);
    try {
      return tx.execute(
          status -> {
            ImportJob job = new ImportJob();
            job.setUser(users.getReferenceById(userId));
            job.setPayload(payload);
            UUID jobId = jobs.saveAndFlush(job).getId();
            // Gửi sau commit: consumer chắc chắn đọc được job
            events.publish(new ImportRequested(userId, jobId, token));
            return jobId;
          });
    } catch (RuntimeException e) {
      lock.release(userId, token);
      throw e;
    }
  }

  @Transactional(readOnly = true)
  public ImportJobResponse get(UUID userId, UUID jobId) {
    ImportJob job = jobs.findByIdAndUserId(jobId, userId).orElseThrow(ApiException::notFound);
    return new ImportJobResponse(
        job.getId(),
        job.getStatus(),
        job.getStats() == null ? null : json.readTree(job.getStats()),
        job.getError(),
        job.getCreatedAt(),
        job.getFinishedAt());
  }

  /** Consumer gọi. Không ném exception ra ngoài: lỗi nghiệp vụ đã ghi vào job, retry cũng vô ích. */
  public void run(ImportRequested event) {
    try {
      Boolean pending =
          newTx.execute(
              status -> {
                ImportJob job = jobs.findById(event.jobId()).orElse(null);
                if (job == null || job.getStatus() == ImportJobStatus.DONE || job.getStatus() == ImportJobStatus.FAILED) {
                  return false;
                }
                job.setStatus(ImportJobStatus.RUNNING);
                return true;
              });
      if (!Boolean.TRUE.equals(pending)) return;

      try {
        newTx.executeWithoutResult(status -> importInOneTransaction(event));
      } catch (RuntimeException e) {
        log.warn("Import job {} failed", event.jobId(), e);
        markFailed(event.jobId(), e);
      }
    } finally {
      lock.release(event.userId(), event.lockToken());
    }
  }

  private void importInOneTransaction(ImportRequested event) {
    ImportJob job = jobs.findById(event.jobId()).orElseThrow();
    Stats stats = importer.importAll(event.userId(), parse(job.getPayload()));
    job.setStatus(ImportJobStatus.DONE);
    job.setStats(json.writeValueAsString(stats));
    job.setFinishedAt(Instant.now());
    job.setPayload(null);
    // Số quán/người yêu thay đổi: xoá cache /stats (một event cho cả lần import)
    events.publish(new EntityChanged(event.userId(), Entity.place, event.jobId(), Action.created));
  }

  private void markFailed(UUID jobId, RuntimeException cause) {
    newTx.executeWithoutResult(
        status ->
            jobs.findById(jobId)
                .ifPresent(
                    job -> {
                      job.setStatus(ImportJobStatus.FAILED);
                      // Không đưa chi tiết kỹ thuật (tên bảng, SQL) cho người dùng; chi tiết nằm trong log
                      job.setError(
                          cause instanceof ApiException api
                              ? api.getMessage()
                              : "Lỗi khi lưu dữ liệu, không có gì được import. Thử lại sau.");
                      job.setFinishedAt(Instant.now());
                    }));
  }

  private LegacyExport parse(String payload) {
    try {
      LegacyExport export = json.readValue(payload, LegacyExport.class);
      if (export == null) throw new ApiException(ErrorCode.MALFORMED_REQUEST, "Dữ liệu import không đúng định dạng.");
      return export;
    } catch (JacksonException e) {
      throw new ApiException(ErrorCode.MALFORMED_REQUEST, "Dữ liệu import không đúng định dạng.");
    }
  }
}
