package com.gfmaster.catalog;

import com.gfmaster.place.PlaceType;
import jakarta.validation.constraints.NotEmpty;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class CatalogDtos {

  private CatalogDtos() {}

  public record DistrictOption(String code, String label) {}

  /** Một quán trong "Khám phá quán". {@code inNotebook}: đã được thêm vào sổ tay của chủ dữ liệu. */
  public record CatalogItem(
      UUID id,
      PlaceType type,
      String name,
      String address,
      String district,
      BigDecimal lat,
      BigDecimal lng,
      String openingHours,
      String cuisine,
      String phone,
      String website,
      Boolean hasWifi,
      boolean inNotebook) {}

  /** {@code lastFetchedAt}: lần nhập gần nhất (null nếu danh mục còn trống). */
  public record CatalogPage(List<CatalogItem> items, long total, int page, int size, Instant lastFetchedAt) {}

  public record ImportRequest(@NotEmpty List<CatalogDistrict> districts, @NotEmpty List<PlaceType> types) {}

  public record ImportRunResponse(
      UUID id,
      CatalogImportRun.Status status,
      List<String> districts,
      List<PlaceType> types,
      int totalCells,
      int doneCells,
      int added,
      int updated,
      List<String> errors,
      Instant startedAt,
      Instant finishedAt) {}
}
