package com.gfmaster.girlfriend;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GirlfriendRepository extends JpaRepository<Girlfriend, UUID> {

  List<Girlfriend> findAllByUserIdOrderByCreatedAtDesc(UUID userId);

  Optional<Girlfriend> findByIdAndUserId(UUID id, UUID userId);

  long deleteByIdAndUserId(UUID id, UUID userId);

  long countByUserId(UUID userId);
}
