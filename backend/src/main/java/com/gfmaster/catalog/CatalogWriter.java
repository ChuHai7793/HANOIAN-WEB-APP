package com.gfmaster.catalog;

import com.gfmaster.place.PlaceType;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ghi kết quả của một ô (quận × loại) trong một transaction: quán đã có (cùng mã OSM) thì cập nhật,
 * chưa có thì thêm. Chạy lại bao nhiêu lần cũng không nhân đôi.
 */
@Component
public class CatalogWriter {

  static final String SOURCE = "osm";

  private final CatalogPlaceRepository catalog;
  private final CatalogImportRunRepository runs;

  public CatalogWriter(CatalogPlaceRepository catalog, CatalogImportRunRepository runs) {
    this.catalog = catalog;
    this.runs = runs;
  }

  public record Counts(int added, int updated) {}

  @Transactional
  public Counts upsert(PlaceType type, CatalogDistrict district, List<OsmPlace> places) {
    Map<String, CatalogPlace> existing =
        catalog
            .findBySourceAndExternalIdIn(SOURCE, places.stream().map(OsmPlace::externalId).toList())
            .stream()
            .collect(Collectors.toMap(CatalogPlace::getExternalId, Function.identity()));
    Instant now = Instant.now();
    int added = 0;
    int updated = 0;
    for (OsmPlace p : places) {
      CatalogPlace c = existing.get(p.externalId());
      if (c == null) {
        c = new CatalogPlace();
        c.setSource(SOURCE);
        c.setExternalId(p.externalId());
        // Quán ở chỗ hai quận chồng nhau: giữ nhãn quận của lần thấy đầu tiên
        c.setDistrict(district.name());
        existing.put(p.externalId(), c);
        added++;
      } else {
        updated++;
      }
      c.setType(type);
      c.setName(p.name());
      c.setAddress(p.address());
      c.setLat(p.lat());
      c.setLng(p.lng());
      c.setOpeningHours(p.openingHours());
      c.setCuisine(p.cuisine());
      c.setPhone(p.phone());
      c.setWebsite(p.website());
      c.setHasWifi(p.hasWifi());
      c.setFetchedAt(now);
    }
    catalog.saveAll(existing.values());
    return new Counts(added, updated);
  }

  /** Một ô xong (thành công hoặc lỗi): cộng tiến trình vào lượt nhập. */
  @Transactional
  public void progress(UUID runId, Counts counts, String error) {
    CatalogImportRun run = runs.findById(runId).orElseThrow();
    run.setDoneCells(run.getDoneCells() + 1);
    run.setAdded(run.getAdded() + counts.added());
    run.setUpdated(run.getUpdated() + counts.updated());
    if (error != null) run.addError(error);
  }

  /** Hết các ô: DONE, hoặc FAILED nếu mọi ô đều lỗi. */
  @Transactional
  public void finish(UUID runId) {
    CatalogImportRun run = runs.findById(runId).orElseThrow();
    boolean allFailed = !run.getErrors().isEmpty() && run.getErrors().lines().count() >= run.getTotalCells();
    run.setStatus(allFailed ? CatalogImportRun.Status.FAILED : CatalogImportRun.Status.DONE);
    run.setFinishedAt(Instant.now());
  }

  /** Lượt "đang chạy" bị bỏ dở (app khởi động lại giữa chừng): đánh dấu thất bại để nhập lại được. */
  @Transactional
  public int failInterrupted(Instant startedBefore) {
    int n = 0;
    for (CatalogImportRun run : runs.findByStatus(CatalogImportRun.Status.RUNNING)) {
      if (startedBefore != null && !run.getStartedAt().isBefore(startedBefore)) continue;
      run.setStatus(CatalogImportRun.Status.FAILED);
      run.setFinishedAt(Instant.now());
      run.addError("Bị gián đoạn (app khởi động lại hoặc chạy quá lâu). Bấm nhập lại để bổ sung.");
      n++;
    }
    return n;
  }
}
