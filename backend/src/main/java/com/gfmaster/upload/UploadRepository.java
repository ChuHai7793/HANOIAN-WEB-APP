package com.gfmaster.upload;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface UploadRepository extends JpaRepository<Upload, UUID> {

  Optional<Upload> findByIdAndUserId(UUID id, UUID userId);

  /**
   * Upload tạo trước {@code before} mà URL không còn được quán (My place, Khám phá quán, kể cả ảnh thêm), người
   * yêu, hồ sơ hay chỗ chơi nào dùng.
   */
  @Query(
      value =
          """
          SELECT u.* FROM uploads u
          WHERE u.created_at < :before
            AND u.storage_key IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM places p WHERE p.image_url = u.url)
            AND NOT EXISTS (SELECT 1 FROM girlfriends g WHERE g.avatar_url = u.url)
            AND NOT EXISTS (SELECT 1 FROM user_profiles up WHERE up.avatar_url = u.url)
            AND NOT EXISTS (SELECT 1 FROM profile_photos pp WHERE pp.url = u.url)
            AND NOT EXISTS (SELECT 1 FROM date_spots ds WHERE ds.image_url = u.url)
            AND NOT EXISTS (SELECT 1 FROM place_catalog pc WHERE pc.image_url = u.url)
            AND NOT EXISTS (SELECT 1 FROM catalog_photos cp WHERE cp.url = u.url)
            AND NOT EXISTS (SELECT 1 FROM spot_photos sp WHERE sp.url = u.url)
            AND NOT EXISTS (SELECT 1 FROM app_settings st WHERE st.value = u.url)
            AND NOT EXISTS (SELECT 1 FROM articles ar WHERE ar.cover_url = u.url)
          ORDER BY u.created_at
          LIMIT :limit
          """,
      nativeQuery = true)
  List<Upload> findOrphans(Instant before, int limit);

  /** Upload đã có ảnh công khai, cũ trước; dùng để sinh bù bản 800px cho ảnh tải lên trước khi có bản này. */
  @Query("select u from Upload u where u.storageKey is not null and u.status = com.gfmaster.upload.UploadStatus.READY order by u.createdAt")
  List<Upload> findReady(Pageable page);

  /** Upload thẳng bỏ dở: chưa gửi ảnh, kẹt khi xử lý, hoặc ảnh hỏng. Chưa có file công khai nào. */
  @Query(
      "select u from Upload u where u.storageKey is null and u.status in :statuses and u.createdAt < :before")
  List<Upload> findUnfinished(Collection<UploadStatus> statuses, Instant before);
}
