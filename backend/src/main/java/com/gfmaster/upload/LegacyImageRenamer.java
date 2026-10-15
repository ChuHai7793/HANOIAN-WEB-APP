package com.gfmaster.upload;

import com.gfmaster.common.messaging.DomainEvent.UploadsDeleted;
import com.gfmaster.common.messaging.DomainEventPublisher;
import com.gfmaster.upload.storage.StorageDriver;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Đổi tên ảnh cũ trên storage từ {@code <id người dùng>/2026/10/<uuid>.webp} sang dạng dễ đọc
 * {@code places/2026/10/cafe-cuoi-ngo-k3f9a1c2.webp} (xem {@link ImageKeys}). Loại ảnh và tên lấy từ chỗ đang
 * dùng ảnh (quán, chỗ chơi, ảnh đại diện, ảnh hồ sơ hẹn hò, người yêu). Ảnh không còn ai dùng thì bỏ qua (job
 * dọn ảnh mồ côi sẽ xoá).
 *
 * <p>Mỗi ảnh một transaction: chép file (và thumbnail) sang tên mới → cập nhật mọi cột đang trỏ tới URL cũ và
 * bản ghi upload → sau khi commit mới xoá file cũ. Lỗi giữa chừng thì xoá file mới vừa chép, ảnh cũ giữ nguyên.
 * Chạy lại nhiều lần được: ảnh đã có tên mới không bị đụng tới.
 */
@Service
public class LegacyImageRenamer {

  private static final Logger log = LoggerFactory.getLogger(LegacyImageRenamer.class);

  /** Tên cũ bắt đầu bằng id người dùng (UUID) */
  private static final String LEGACY_KEY = "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/";

  /** Mọi cột đang lưu URL ảnh (giống danh sách trong UploadRepository.findOrphans) */
  private static final List<String[]> URL_COLUMNS =
      List.of(
          new String[] {"places", "image_url"},
          new String[] {"girlfriends", "avatar_url"},
          new String[] {"user_profiles", "avatar_url"},
          new String[] {"profile_photos", "url"},
          new String[] {"date_spots", "image_url"},
          new String[] {"place_catalog", "image_url"},
          new String[] {"catalog_photos", "url"},
          new String[] {"spot_photos", "url"},
          new String[] {"app_settings", "value"});

  /**
   * Ảnh đang được dùng ở đâu, theo thứ tự ưu tiên khi một ảnh dùng ở nhiều chỗ (vd. quán trong Khám phá quán
   * và bản sao trong My place): loại ảnh + tên dùng đặt file.
   */
  private static final String USAGE =
      """
      SELECT purpose, name FROM (
        SELECT 1 AS prio, 'place' AS purpose, pc.name FROM place_catalog pc WHERE pc.image_url = :url
        UNION ALL SELECT 2, 'place', pc.name FROM catalog_photos cp JOIN place_catalog pc ON pc.id = cp.catalog_id WHERE cp.url = :url
        UNION ALL SELECT 3, 'spot', ds.name FROM date_spots ds WHERE ds.image_url = :url
        UNION ALL SELECT 4, 'spot', ds.name FROM spot_photos sp JOIN date_spots ds ON ds.id = sp.spot_id WHERE sp.url = :url
        UNION ALL SELECT 5, 'place', p.name FROM places p WHERE p.image_url = :url
        UNION ALL SELECT 6, 'avatar', u.display_name FROM user_profiles up JOIN users u ON u.id = up.user_id WHERE up.avatar_url = :url
        UNION ALL SELECT 7, 'dating', u.display_name FROM profile_photos pp JOIN users u ON u.id = pp.user_id WHERE pp.url = :url
        UNION ALL SELECT 8, 'girlfriend', g.name FROM girlfriends g WHERE g.avatar_url = :url
      ) x ORDER BY prio LIMIT 1
      """;

  public record Renamed(String from, String to, String purpose) {}

  public record Report(int scanned, int renamed, int unused, int failed, boolean dryRun, List<Renamed> items) {}

  private record Candidate(UUID id, UUID userId, String storageKey, String url, String thumbUrl) {}

  private final NamedParameterJdbcTemplate jdbc;
  private final StorageDriver storage;
  private final DomainEventPublisher events;
  private final TransactionTemplate tx;

  public LegacyImageRenamer(
      NamedParameterJdbcTemplate jdbc,
      StorageDriver storage,
      DomainEventPublisher events,
      PlatformTransactionManager transactions) {
    this.jdbc = jdbc;
    this.storage = storage;
    this.events = events;
    this.tx = new TransactionTemplate(transactions);
  }

  /**
   * @param dryRun true: chỉ liệt kê sẽ đổi gì, không chép / sửa / xoá
   * @param limit số ảnh tối đa mỗi lần chạy (chạy lại tới khi {@code renamed} = 0)
   */
  public Report run(boolean dryRun, int limit) {
    List<Candidate> candidates =
        jdbc.query(
            """
            SELECT id, user_id, storage_key, url, thumb_url FROM uploads
            WHERE storage_key ~ :pattern AND url IS NOT NULL
            ORDER BY created_at
            LIMIT :limit
            """,
            Map.of("pattern", LEGACY_KEY, "limit", Math.max(1, Math.min(limit, 1000))),
            (rs, i) ->
                new Candidate(
                    rs.getObject("id", UUID.class),
                    rs.getObject("user_id", UUID.class),
                    rs.getString("storage_key"),
                    rs.getString("url"),
                    rs.getString("thumb_url")));

    List<Renamed> items = new ArrayList<>();
    int unused = 0;
    int failed = 0;
    for (Candidate c : candidates) {
      var usage = jdbc.queryForList(USAGE, Map.of("url", c.url()));
      if (usage.isEmpty()) {
        unused++;
        continue;
      }
      ImagePurpose purpose = ImagePurpose.parse((String) usage.get(0).get("purpose"));
      String name = (String) usage.get(0).get("name");
      String newKey = ImageKeys.newPublicKey(purpose, name);
      if (dryRun) {
        items.add(new Renamed(c.storageKey(), newKey, purpose.name()));
        continue;
      }
      try {
        items.add(rename(c, purpose, name, newKey));
      } catch (RuntimeException e) {
        failed++;
        log.warn("Không đổi được tên ảnh {}: {}", c.storageKey(), e.toString());
      }
    }
    return new Report(candidates.size(), dryRun ? 0 : items.size(), unused, failed, dryRun, items);
  }

  private Renamed rename(Candidate c, ImagePurpose purpose, String name, String newKey) {
    String oldThumb = UploadService.thumbKeyOf(c.storageKey());
    String newThumb = UploadService.thumbKeyOf(newKey);
    // Chép file trước (ngoài transaction DB); lỗi DB sau đó thì xoá bản chép
    String newUrl = storage.put(newKey, storage.get(c.storageKey()), UploadService.WEBP);
    String newThumbUrl = null;
    boolean hasThumb = c.thumbUrl() != null && storage.exists(oldThumb);
    try {
      if (hasThumb) newThumbUrl = storage.put(newThumb, storage.get(oldThumb), UploadService.WEBP);
      String thumbUrl = newThumbUrl;
      tx.executeWithoutResult(
          status -> {
            for (String[] col : URL_COLUMNS) {
              jdbc.update(
                  "UPDATE " + col[0] + " SET " + col[1] + " = :new WHERE " + col[1] + " = :old",
                  Map.of("new", newUrl, "old", c.url()));
            }
            jdbc.update(
                """
                UPDATE uploads SET storage_key = :key, url = :url, thumb_url = COALESCE(:thumb, thumb_url),
                                   purpose = :purpose, name_hint = :name
                WHERE id = :id
                """,
                new MapSqlParameterSource("key", newKey)
                    .addValue("url", newUrl)
                    .addValue("thumb", thumbUrl)
                    .addValue("purpose", purpose.name())
                    .addValue("name", UploadService.hint(name))
                    .addValue("id", c.id()));
            // File cũ xoá sau commit (cùng cơ chế xoá upload thường)
            events.publish(new UploadsDeleted(c.userId(), hasThumb ? List.of(c.storageKey(), oldThumb) : List.of(c.storageKey())));
          });
    } catch (RuntimeException e) {
      storage.delete(newKey);
      if (newThumbUrl != null) storage.delete(newThumb);
      throw e;
    }
    return new Renamed(c.storageKey(), newKey, purpose.name());
  }
}
