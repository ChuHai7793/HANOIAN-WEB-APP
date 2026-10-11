package com.gfmaster.catalog;

import com.gfmaster.catalog.CatalogDtos.CatalogPage;
import com.gfmaster.catalog.CatalogDtos.DistrictOption;
import com.gfmaster.catalog.CatalogDtos.ImportRequest;
import com.gfmaster.catalog.CatalogDtos.ImportRunResponse;
import com.gfmaster.common.security.CurrentUser;
import com.gfmaster.common.security.DataOwner;
import com.gfmaster.place.PlaceType;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /catalog}: "Khám phá quán", mọi người đã đăng nhập đều xem được. {@code /admin/catalog}: nhập
 * từ OpenStreetMap, chỉ admin (SecurityConfig chặn {@code /api/v1/admin/**}).
 */
@RestController
public class CatalogController {

  private final CatalogService catalog;
  private final CatalogImportService importer;

  public CatalogController(CatalogService catalog, CatalogImportService importer) {
    this.catalog = catalog;
    this.importer = importer;
  }

  @GetMapping("/api/v1/catalog")
  public CatalogPage search(
      @DataOwner UUID ownerId,
      @RequestParam(required = false) String q,
      @RequestParam(required = false) PlaceType type,
      @RequestParam(required = false) CatalogDistrict district,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "30") int size) {
    return catalog.search(ownerId, q, type, district, page, size);
  }

  @GetMapping("/api/v1/catalog/districts")
  public List<DistrictOption> districts() {
    return catalog.districts();
  }

  @PostMapping("/api/v1/admin/catalog/import")
  public ResponseEntity<ImportRunResponse> startImport(
      @CurrentUser UUID adminId, @Valid @RequestBody ImportRequest request) {
    return ResponseEntity.status(HttpStatus.ACCEPTED)
        .body(importer.start(adminId, request.districts(), request.types()));
  }

  @GetMapping("/api/v1/admin/catalog/runs")
  public List<ImportRunResponse> runs() {
    return importer.recentRuns();
  }
}
