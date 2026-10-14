package com.gfmaster.review;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class ReviewDtos {

  private ReviewDtos() {}

  /** Địa điểm được đánh giá: quán (Khám phá quán) hoặc chỗ chơi (Tìm chỗ chơi). */
  public enum TargetType {
    place("place_catalog"),
    spot("date_spots");

    /** Bảng chứa địa điểm (hằng trong code, ghép vào SQL được) */
    final String table;

    TargetType(String table) {
      this.table = table;
    }
  }

  public enum ReviewSort {
    /** Nhiều "Hữu ích" trước, rồi mới nhất */
    helpful,
    newest,
    high,
    low
  }

  public record ReviewRequest(
      @Min(1) @Max(5) int rating,
      @NotBlank @Size(min = 10, max = 1000) String body,
      @Pattern(regexp = "lover|friends|solo|family") String companion) {}

  public record Author(UUID id, String displayName, String avatarUrl) {}

  public record ReviewView(
      UUID id,
      Author author,
      int rating,
      String body,
      String companion,
      int helpfulCount,
      /** Người đang xem đã bấm "Hữu ích" chưa (khách: false) */
      boolean helpedByMe,
      /** Đánh giá của chính người đang xem */
      boolean mine,
      Instant createdAt,
      Instant updatedAt) {}

  /** Điểm trung bình và số đánh giá theo từng mức sao (histogram[0] = 1 sao … histogram[4] = 5 sao) */
  public record ReviewSummary(BigDecimal average, int count, List<Integer> histogram) {}

  public record ReviewPage(
      ReviewSummary summary,
      /** Đánh giá của người đang xem cho địa điểm này (null: chưa viết / khách) */
      ReviewView mine,
      List<ReviewView> items,
      long total,
      int page,
      int size) {}

  public record HelpfulResult(int helpfulCount, boolean helpedByMe) {}
}
