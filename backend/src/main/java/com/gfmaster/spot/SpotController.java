package com.gfmaster.spot;

import com.gfmaster.catalog.CatalogDistrict;
import com.gfmaster.common.security.MyPlaceOwner;
import com.gfmaster.spot.SpotDtos.SpotItem;
import com.gfmaster.spot.SpotDtos.SpotPage;
import jakarta.validation.Valid;
import java.time.LocalTime;
import java.util.Map;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
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
import com.gfmaster.spot.SpotDtos.SpotRequest;
import java.util.List;

/**
 * "Tìm chỗ chơi". Mọi người đã đăng nhập: xem ({@code GET /spots}). Chỉ admin: thêm/sửa/xoá
 * ({@code /admin/spots}, SecurityConfig chặn). Danh sách khu vực dùng chung {@code GET /catalog/districts}.
 */
@RestController
public class SpotController {

  private final SpotService spots;

  public SpotController(SpotService spots) {
    this.spots = spots;
  }

  /** Công khai: khách xem được (inMyPlace luôn false) */
  @GetMapping("/api/v1/spots")
  public SpotPage search(
      @MyPlaceOwner(required = false) UUID userId,
      @RequestParam(required = false) String q,
      @RequestParam(required = false) SpotCategory category,
      @RequestParam(required = false) CatalogDistrict district,
      @RequestParam(required = false) Integer maxPrice,
      @RequestParam(required = false) Boolean indoor,
      @RequestParam(required = false) @DateTimeFormat(pattern = "HH:mm") LocalTime openAt,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "30") int size) {
    return spots.search(userId, q, category, district, maxPrice, indoor, openAt, page, size);
  }

  @GetMapping("/api/v1/spots/counts")
  public Map<String, Long> counts(
      @RequestParam(required = false) String q,
      @RequestParam(required = false) CatalogDistrict district,
      @RequestParam(required = false) Integer maxPrice,
      @RequestParam(required = false) Boolean indoor,
      @RequestParam(required = false) @DateTimeFormat(pattern = "HH:mm") LocalTime openAt) {
    return spots.counts(q, district, maxPrice, indoor, openAt);
  }

  /** My place: chỗ chơi đã lưu của người đang đăng nhập */
  /** Công khai: trang riêng của chỗ chơi /cho-choi/{slug} */
  @GetMapping("/api/v1/spots/by-slug/{slug}")
  public SpotItem bySlug(@MyPlaceOwner(required = false) UUID userId, @PathVariable String slug) {
    return spots.bySlug(userId, slug);
  }

  @GetMapping("/api/v1/me/spots")
  public List<SpotItem> saved(@MyPlaceOwner UUID userId) {
    return spots.saved(userId);
  }

  /** "Lưu vào My place" (mọi người, kể cả guest) */
  @PostMapping("/api/v1/spots/{id}/my-place")
  public ResponseEntity<SpotItem> save(@MyPlaceOwner UUID userId, @PathVariable UUID id) {
    return ResponseEntity.status(HttpStatus.CREATED).body(spots.save(userId, id));
  }

  @DeleteMapping("/api/v1/spots/{id}/my-place")
  public ResponseEntity<Void> unsave(@MyPlaceOwner UUID userId, @PathVariable UUID id) {
    spots.unsave(userId, id);
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/api/v1/admin/spots")
  public ResponseEntity<SpotItem> create(@Valid @RequestBody SpotRequest request) {
    return ResponseEntity.status(HttpStatus.CREATED).body(spots.create(request));
  }

  @PutMapping("/api/v1/admin/spots/{id}")
  public SpotItem update(@PathVariable UUID id, @Valid @RequestBody SpotRequest request) {
    return spots.update(id, request);
  }

  @DeleteMapping("/api/v1/admin/spots/{id}")
  public ResponseEntity<Void> delete(@PathVariable UUID id) {
    spots.delete(id);
    return ResponseEntity.noContent().build();
  }
}
