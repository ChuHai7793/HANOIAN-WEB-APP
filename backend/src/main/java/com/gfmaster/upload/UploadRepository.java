package com.gfmaster.upload;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface UploadRepository extends JpaRepository<Upload, UUID> {

  Optional<Upload> findByIdAndUserId(UUID id, UUID userId);

  /** Upload tạo trước {@code before} mà URL không còn được quán hay người yêu nào dùng. */
  @Query(
      value =
          """
          SELECT u.* FROM uploads u
          WHERE u.created_at < :before
            AND NOT EXISTS (SELECT 1 FROM places p WHERE p.image_url = u.url)
            AND NOT EXISTS (SELECT 1 FROM girlfriends g WHERE g.avatar_url = u.url)
          ORDER BY u.created_at
          LIMIT :limit
          """,
      nativeQuery = true)
  List<Upload> findOrphans(Instant before, int limit);
}
