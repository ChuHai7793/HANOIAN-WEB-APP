package com.gfmaster.importer;

import com.gfmaster.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

/** Job import dữ liệu localStorage cũ (xử lý bất đồng bộ qua RabbitMQ). */
@Entity
@Table(name = "import_jobs")
@Getter
@Setter
public class ImportJob {

  @Id
  @UuidGenerator
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false, updatable = false)
  private User user;

  @Enumerated(EnumType.STRING)
  @JdbcTypeCode(SqlTypes.VARCHAR)
  @Column(nullable = false, length = 20)
  private ImportJobStatus status = ImportJobStatus.QUEUED;

  /** Chỉ dùng khi payload nằm ở storage ngoài (S3); hiện payload lưu thẳng trong cột {@code payload}. */
  @Column(length = 255)
  private String payloadKey;

  /** JSON gốc từ localStorage. Xoá (null) khi import xong; job lỗi giữ lại vài ngày để xem. */
  @Column(columnDefinition = "text")
  private String payload;

  /** JSON dạng {"places":12,"girlfriends":3,...}, lưu dạng chuỗi trong cột text. */
  @Column(columnDefinition = "text")
  private String stats;

  @Column(columnDefinition = "text")
  private String error;

  @CreationTimestamp
  @Column(nullable = false, updatable = false)
  private Instant createdAt;

  private Instant finishedAt;
}
