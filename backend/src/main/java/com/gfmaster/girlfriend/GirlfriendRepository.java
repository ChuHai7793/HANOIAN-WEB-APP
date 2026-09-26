package com.gfmaster.girlfriend;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GirlfriendRepository extends JpaRepository<Girlfriend, UUID> {

  // Nạp sẵn hobbies để tránh N+1 khi map danh sách
  @EntityGraph(attributePaths = "hobbies")
  List<Girlfriend> findAllByUserIdOrderByCreatedAtDesc(UUID userId);

  @EntityGraph(attributePaths = "hobbies")
  Optional<Girlfriend> findByIdAndUserId(UUID id, UUID userId);

  boolean existsByIdAndUserId(UUID id, UUID userId);

  long deleteByIdAndUserId(UUID id, UUID userId);

  long countByUserId(UUID userId);
}
