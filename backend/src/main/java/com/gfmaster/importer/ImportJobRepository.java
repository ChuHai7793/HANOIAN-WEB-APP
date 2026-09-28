package com.gfmaster.importer;

import java.time.Instant;
import java.util.Collection;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface ImportJobRepository extends JpaRepository<ImportJob, UUID> {

  Optional<ImportJob> findByIdAndUserId(UUID id, UUID userId);

  /** Bỏ payload (có thể vài MB) của job đã kết thúc từ trước {@code before}. */
  @Modifying
  @Query("update ImportJob j set j.payload = null where j.payload is not null and j.finishedAt < :before")
  int clearPayloadsFinishedBefore(Instant before);

  /** Job kẹt (message bị mất, app chết giữa chừng): đánh dấu FAILED để người dùng thử lại. */
  @Modifying
  @Query(
      """
      update ImportJob j set j.status = com.gfmaster.importer.ImportJobStatus.FAILED,
        j.error = :error, j.finishedAt = :now
      where j.status in :statuses and j.createdAt < :before
      """)
  int failStuck(Collection<ImportJobStatus> statuses, Instant before, Instant now, String error);
}
