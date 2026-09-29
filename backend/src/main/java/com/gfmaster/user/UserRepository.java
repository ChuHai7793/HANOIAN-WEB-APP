package com.gfmaster.user;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, UUID> {

  Optional<User> findByEmailIgnoreCase(String email);

  Optional<User> findByUsernameIgnoreCase(String username);

  boolean existsByEmailIgnoreCase(String email);

  /** Admin đầu tiên: chủ dữ liệu mà tài khoản đăng ký mới (guest) được xem. */
  Optional<User> findFirstByRoleOrderByCreatedAtAsc(Role role);
}
