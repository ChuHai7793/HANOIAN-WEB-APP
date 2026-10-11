package com.gfmaster.catalog;

import com.gfmaster.catalog.CatalogDtos.ImportRunResponse;
import com.gfmaster.catalog.CatalogWriter.Counts;
import com.gfmaster.catalog.OverpassClient.OverpassException;
import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.error.ErrorCode;
import com.gfmaster.place.PlaceType;
import java.time.Instant;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.task.TaskExecutor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

/**
 * Nhập "Khám phá quán" từ OpenStreetMap: admin chọn quận và loại quán, mỗi cặp (quận × loại) là một
 * ô, gọi Overpass một lần. Chạy nền trên {@code applicationTaskExecutor} (không cần RabbitMQ, nên chạy
 * được cả trên Render). Ô lỗi được ghi lại, các ô khác vẫn chạy; nhập lại thì bổ sung phần còn thiếu.
 *
 * <p>Chỉ một lượt chạy cùng lúc: unique index {@code uk_catalog_run_running} chặn ngay ở DB. Lượt bị
 * bỏ dở (app khởi động lại) được đánh dấu FAILED khi app lên lại, và khi chạy quá {@code staleAfter}.
 */
@Service
public class CatalogImportService {

  private static final Logger log = LoggerFactory.getLogger(CatalogImportService.class);

  private final CatalogImportRunRepository runs;
  private final CatalogWriter writer;
  private final OverpassClient overpass;
  private final CatalogProperties props;
  private final TaskExecutor executor;

  public CatalogImportService(
      CatalogImportRunRepository runs,
      CatalogWriter writer,
      OverpassClient overpass,
      CatalogProperties props,
      @Qualifier("applicationTaskExecutor") TaskExecutor executor) {
    this.runs = runs;
    this.writer = writer;
    this.overpass = overpass;
    this.props = props;
    this.executor = executor;
  }

  /** App vừa khởi động: không lượt nào còn chạy thật, mọi lượt RUNNING đều đã bị bỏ dở. */
  @EventListener(ApplicationReadyEvent.class)
  public void failRunsLeftByPreviousProcess() {
    int n = writer.failInterrupted(null);
    if (n > 0) log.warn("Marked {} interrupted catalog import run(s) as FAILED", n);
  }

  public ImportRunResponse start(UUID adminId, List<CatalogDistrict> districts, List<PlaceType> types) {
    List<CatalogDistrict> ds = List.copyOf(new LinkedHashSet<>(districts));
    List<PlaceType> ts = List.copyOf(new LinkedHashSet<>(types));
    writer.failInterrupted(Instant.now().minus(props.staleAfter()));

    CatalogImportRun run = new CatalogImportRun();
    run.setRequestedBy(adminId);
    run.setStatus(CatalogImportRun.Status.RUNNING);
    run.setDistricts(ds.stream().map(Enum::name).collect(Collectors.joining(",")));
    run.setTypes(ts.stream().map(Enum::name).collect(Collectors.joining(",")));
    run.setTotalCells(ds.size() * ts.size());
    run.setStartedAt(Instant.now());
    try {
      run = runs.saveAndFlush(run);
    } catch (DataIntegrityViolationException e) {
      throw new ApiException(ErrorCode.IMPORT_RUNNING, "Đang có một lượt nhập khác chạy, chờ lượt đó xong.");
    }
    UUID runId = run.getId();
    executor.execute(() -> runCells(runId, ds, ts));
    return toResponse(run);
  }

  public List<ImportRunResponse> recentRuns() {
    return runs.findTop10ByOrderByStartedAtDesc().stream().map(CatalogImportService::toResponse).toList();
  }

  private void runCells(UUID runId, List<CatalogDistrict> districts, List<PlaceType> types) {
    try {
      boolean first = true;
      for (CatalogDistrict d : districts) {
        for (PlaceType t : types) {
          if (!first) pause();
          first = false;
          String cell = d.label() + " – " + typeLabel(t);
          try {
            writer.progress(runId, writer.upsert(t, d, overpass.fetch(t, d)), null);
          } catch (OverpassException e) {
            writer.progress(runId, new Counts(0, 0), cell + ": " + e.getMessage());
          } catch (RuntimeException e) {
            log.error("Catalog import cell {} failed", cell, e);
            writer.progress(runId, new Counts(0, 0), cell + ": lỗi khi lưu dữ liệu");
          }
        }
      }
    } finally {
      writer.finish(runId);
    }
  }

  private void pause() {
    try {
      Thread.sleep(props.delayBetweenCells());
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }

  static String typeLabel(PlaceType t) {
    return switch (t) {
      case cafe -> "Cafe";
      case restaurant -> "Nhà hàng";
      case bar -> "Bar";
    };
  }

  static ImportRunResponse toResponse(CatalogImportRun r) {
    return new ImportRunResponse(
        r.getId(),
        r.getStatus(),
        Arrays.stream(r.getDistricts().split(",")).map(c -> CatalogDistrict.valueOf(c).label()).toList(),
        Arrays.stream(r.getTypes().split(",")).map(PlaceType::valueOf).toList(),
        r.getTotalCells(),
        r.getDoneCells(),
        r.getAdded(),
        r.getUpdated(),
        r.getErrors().isEmpty() ? List.of() : r.getErrors().lines().toList(),
        r.getStartedAt(),
        r.getFinishedAt());
  }
}
