package com.gfmaster.profile;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

/**
 * Hồ sơ cá nhân, quan hệ 1–1 với users qua khoá chính {@code user_id} (không dùng BaseEntity vì id
 * không tự sinh mà chính là id của user). {@code version == null} = chưa lưu lần nào.
 */
@Entity
@Table(name = "user_profiles")
@Getter
@Setter
public class UserProfile {

  @Id
  @Column(name = "user_id")
  private UUID userId;

  @Column(length = 1024)
  private String avatarUrl;

  private LocalDate birthday;

  @Enumerated(EnumType.STRING)
  @JdbcTypeCode(SqlTypes.VARCHAR)
  @Column(length = 10)
  private Gender gender;

  @Column(length = 20)
  private String phone;

  @Column(length = 80)
  private String city;

  @Column(nullable = false, columnDefinition = "text")
  private String bio = "";

  private Instant completedAt;

  @CreationTimestamp
  @Column(nullable = false, updatable = false)
  private Instant createdAt;

  @UpdateTimestamp
  @Column(nullable = false)
  private Instant updatedAt;

  @Version
  @Column(nullable = false)
  private Long version;
}
