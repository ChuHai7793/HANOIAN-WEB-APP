package com.gfmaster.catalog;

import com.gfmaster.catalog.CatalogDtos.CatalogItem;
import com.gfmaster.catalog.CatalogDtos.CatalogPage;
import com.gfmaster.catalog.CatalogDtos.CatalogRequest;
import com.gfmaster.catalog.CatalogDtos.DistrictOption;
import com.gfmaster.common.security.MyPlaceOwner;
import com.gfmaster.place.PlaceType;
import com.gfmaster.place.dto.PlaceResponse;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * "Khám phá quán". Mọi người đã đăng nhập: xem ({@code GET /catalog}) và "Add vào My place" ({@code POST
 * /catalog/{id}/my-place}). Chỉ admin: thêm/sửa/xoá ({@code /admin/catalog}, SecurityConfig chặn).
 */
@RestController
public class CatalogController {

  private final CatalogService catalog;

  public CatalogController(CatalogService catalog) {
    this.catalog = catalog;
  }

  /** Công khai: khách xem được (không có "đã lưu" / "người hợp gu") */
  @GetMapping("/api/v1/catalog")
  public CatalogPage search(
      @MyPlaceOwner(required = false) UUID userId,
      @RequestParam(required = false) String q,
      @RequestParam(required = false) PlaceType type,
      @RequestParam(required = false) CatalogDistrict district,
      @RequestParam(defaultValue = "false") boolean mine,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "30") int size) {
    return catalog.search(userId, q, type, district, mine, page, size);
  }

  @GetMapping("/api/v1/catalog/counts")
  public Map<String, Long> counts(
      @RequestParam(required = false) String q, @RequestParam(required = false) CatalogDistrict district) {
    return catalog.counts(q, district);
  }

  @GetMapping("/api/v1/catalog/districts")
  public List<DistrictOption> districts() {
    return catalog.districts();
  }

  @PostMapping("/api/v1/catalog/{id}/my-place")
  public ResponseEntity<PlaceResponse> addToMyPlace(@MyPlaceOwner UUID userId, @PathVariable UUID id) {
    PlaceResponse place = catalog.addToMyPlace(userId, id);
    return ResponseEntity.created(URI.create("/api/v1/places/" + place.id())).body(place);
  }

  @PostMapping("/api/v1/admin/catalog")
  public ResponseEntity<CatalogItem> create(@Valid @RequestBody CatalogRequest request) {
    return ResponseEntity.status(HttpStatus.CREATED).body(catalog.create(request));
  }

  @PutMapping("/api/v1/admin/catalog/{id}")
  public CatalogItem update(@PathVariable UUID id, @Valid @RequestBody CatalogRequest request) {
    return catalog.update(id, request);
  }

  @DeleteMapping("/api/v1/admin/catalog/{id}")
  public ResponseEntity<Void> delete(@PathVariable UUID id) {
    catalog.delete(id);
    return ResponseEntity.noContent().build();
  }
}
