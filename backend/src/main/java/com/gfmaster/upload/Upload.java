package com.gfmaster.upload;

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

/** Ảnh đã upload. Bảng chỉ ghi thêm, không cần {@code version}. */
@Entity
@Table(name = "uploads")
@Getter
@Setter
public class Upload {

  @Id
  @UuidGenerator
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false, updatable = false)
  private User user;

  /** Ảnh đã xử lý trong storage công khai; null khi chưa xử lý xong. */
  @Column(length = 255)
  private String storageKey;

  /** Ảnh gốc trong vùng lưu riêng tư (upload thẳng); null sau khi xử lý. */
  @Column(length = 255)
  private String incomingKey;

  /** Dạng lưu {@code /uploads/<key>} (ImageUrls); null khi chưa xử lý xong. */
  @Column(length = 1024)
  private String url;

  @Column(length = 1024)
  private String thumbUrl;

  @Column(nullable = false, length = 50)
  private String mimeType;

  @Column(nullable = false)
  private int sizeBytes;

  private Integer width;

  private Integer height;

  @Enumerated(EnumType.STRING)
  @JdbcTypeCode(SqlTypes.VARCHAR)
  @Column(nullable = false, length = 20)
  private UploadStatus status = UploadStatus.READY;

  @CreationTimestamp
  @Column(nullable = false, updatable = false)
  private Instant createdAt;
}
