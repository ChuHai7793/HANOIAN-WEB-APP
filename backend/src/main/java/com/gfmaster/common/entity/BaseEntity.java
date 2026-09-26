package com.gfmaster.common.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

/** id UUID + audit time + {@code @Version} cho optimistic locking. */
@MappedSuperclass
@Getter
@Setter
public abstract class BaseEntity {

  @Id
  @UuidGenerator
  private UUID id;

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
