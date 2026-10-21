package com.gfmaster.user;

import com.gfmaster.auth.social.SocialProvider;
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

/**
 * Danh tính ngoài (Google, Facebook) gắn với một user. {@code subject}: id cố định do nhà cung cấp cấp (Google
 * {@code sub}, Facebook user id), không đổi khi người dùng đổi email. {@code email}: email lúc liên kết, chỉ để
 * hiển thị / tra cứu.
 */
@Entity
@Table(name = "user_identities")
@Getter
@Setter
public class UserIdentity extends BaseEntity {

  @Column(name = "user_id", nullable = false)
  private UUID userId;

  @Enumerated(EnumType.STRING)
  @JdbcTypeCode(SqlTypes.VARCHAR)
  @Column(nullable = false, length = 20)
  private SocialProvider provider;

  @Column(nullable = false, length = 255)
  private String subject;

  @Column(nullable = false, length = 255)
  private String email = "";
}
