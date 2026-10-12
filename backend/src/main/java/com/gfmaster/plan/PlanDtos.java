package com.gfmaster.plan;

import com.gfmaster.catalog.CatalogDistrict;
import com.gfmaster.vibe.Vibe;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

public final class PlanDtos {

  private PlanDtos() {}

  public enum PlanStatus {
    draft,
    scheduled,
    done
  }

  /** Điểm dừng là quán trong Khám phá quán ({@code place}) hay chỗ chơi ({@code spot}). */
  public enum StopKind {
    place,
    spot
  }

  /** Buổi cho Autoplan: giờ bắt đầu và khung lịch trình. */
  public enum Slot {
    afternoon,
    evening,
    day
  }

  /** Tạo / sửa phần chung của plan. {@code version}: khi sửa phải gửi version đã đọc. */
  public record PlanRequest(
      @NotBlank @Size(max = 120) String title,
      LocalDate date,
      @NotNull LocalTime startTime,
      CatalogDistrict district,
      @Size(max = 2000) String note,
      PlanStatus status,
      @Size(max = 4000) String memory,
      Vibe vibe,
      @Min(0) @Max(100_000_000) Integer budget,
      Boolean rainy,
      Long version) {}

  /** Thêm một điểm: {@code refId} là id quán (Khám phá quán) hoặc id chỗ chơi. {@code position} null = cuối. */
  public record AddStopRequest(@NotNull StopKind kind, @NotNull UUID refId, @Min(15) @Max(600) Integer durationMin, @Min(0) Integer position) {}

  /** Sửa một điểm: chỉ field nào gửi (khác null) mới đổi. */
  public record StopPatch(
      @Min(15) @Max(600) Integer durationMin,
      @Size(max = 500) String note,
      @Min(1) @Max(5) Integer rating,
      @Size(max = 2000) String memory) {}

  public record ReorderRequest(@NotEmpty List<UUID> stopIds) {}

  public record AutoplanRequest(
      @NotNull CatalogDistrict district, LocalDate date, Slot slot, Vibe vibe, @Min(0) @Max(100_000_000) Integer budget, Boolean rainy) {}

  public record ShareRequest(@NotNull UUID matchId) {}

  public record SaveToGirlfriendRequest(@NotNull UUID girlfriendId) {}

  // ---- Trả về ----

  /**
   * Một điểm trong lịch trình, kèm giờ tới / rời, quãng đường từ điểm trước (null nếu thiếu toạ độ) và cảnh
   * báo: {@code CLOSED} (đóng cửa lúc tới), {@code CLOSES_EARLY} (đóng trước lúc rời), {@code FAR} (cách điểm
   * trước hơn 3km), {@code SAME_TYPE} (cùng loại với điểm trước), {@code NEEDS_BOOKING}, {@code OUTDOOR_RAIN}
   * (ngoài trời mà plan chọn trời mưa).
   */
  public record StopView(
      UUID id,
      int position,
      StopKind kind,
      UUID refId,
      /** cafe / bar / restaurant, hoặc nhóm chỗ chơi */
      String category,
      String name,
      String address,
      String district,
      String districtLabel,
      String imageUrl,
      Double lat,
      Double lng,
      LocalTime openTime,
      LocalTime closeTime,
      boolean indoor,
      List<Vibe> vibes,
      String googleMapsUrl,
      int durationMin,
      String note,
      Integer rating,
      String memory,
      LocalTime arrival,
      LocalTime departure,
      Integer distanceFromPrevM,
      Integer travelFromPrevMin,
      /** walk / ride (xe máy), null ở điểm đầu */
      String travelMode,
      List<String> warnings) {}

  /** {@code mine}: false khi người xem được rủ đi (xem qua tin nhắn), chỉ đọc. */
  public record PlanView(
      UUID id,
      String title,
      LocalDate date,
      LocalTime startTime,
      LocalTime endTime,
      String district,
      String districtLabel,
      String note,
      PlanStatus status,
      String memory,
      Vibe vibe,
      Integer budget,
      boolean rainy,
      boolean mine,
      String ownerName,
      int totalDistanceM,
      List<StopView> stops,
      Long version,
      Instant createdAt,
      Instant updatedAt) {}

  public record PlanSummary(
      UUID id,
      String title,
      LocalDate date,
      LocalTime startTime,
      String districtLabel,
      PlanStatus status,
      int stopCount,
      List<String> stopNames,
      String imageUrl,
      Instant updatedAt) {}

  /** Plan Autoplan vừa tạo, kèm ghi chú (vd. khu vực thiếu chỗ nên lấy ở quận khác). */
  public record AutoplanResult(PlanView plan, List<String> notes) {}

  public record SaveToGirlfriendResult(int linked, int skipped) {}
}
