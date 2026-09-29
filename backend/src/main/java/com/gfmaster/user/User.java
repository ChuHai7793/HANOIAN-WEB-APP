package com.gfmaster.user;

import com.gfmaster.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "users")
@Getter
@Setter
public class User extends BaseEntity {

  @Column(nullable = false, length = 255)
  private String email;

  /** Tên đăng nhập ngắn (ví dụ {@code admin}); null thì chỉ đăng nhập bằng email. */
  @Column(length = 50)
  private String username;

  @Column(nullable = false, length = 100)
  private String passwordHash;

  @Column(nullable = false, length = 80)
  private String displayName;

  @Enumerated(EnumType.STRING)
  @JdbcTypeCode(SqlTypes.VARCHAR)
  @Column(nullable = false, length = 10)
  private Role role = Role.ADMIN;

  /** Chỉ với GUEST: admin có dữ liệu mà guest được xem. */
  @Column(name = "owner_id")
  private UUID ownerId;

  /** Dữ liệu (quán, người yêu...) mà user này làm việc cùng: của chính mình, hoặc của admin nếu là guest. */
  public UUID dataOwnerId() {
    return role == Role.GUEST && ownerId != null ? ownerId : getId();
  }
}
