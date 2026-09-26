package com.gfmaster.user;

import com.gfmaster.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "users")
@Getter
@Setter
public class User extends BaseEntity {

  @Column(nullable = false, length = 255)
  private String email;

  @Column(nullable = false, length = 100)
  private String passwordHash;

  @Column(nullable = false, length = 80)
  private String displayName;
}
