package com.gfmaster.common.entity;

import com.gfmaster.user.User;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;
import lombok.Setter;

/** Entity thuộc về một user. Mọi truy vấn phải lọc theo {@code user.id}. */
@MappedSuperclass
@Getter
@Setter
public abstract class OwnedEntity extends BaseEntity {

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "user_id", nullable = false, updatable = false)
  private User user;
}
