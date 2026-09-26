package com.gfmaster.upload;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UploadRepository extends JpaRepository<Upload, UUID> {

  Optional<Upload> findByIdAndUserId(UUID id, UUID userId);
}
