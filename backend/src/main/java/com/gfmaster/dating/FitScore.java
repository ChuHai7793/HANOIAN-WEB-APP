package com.gfmaster.dating;

/**
 * "Hợp gu %" chỉ dựa trên số quán cùng lưu: chung / max(3, số quán của người lưu ít hơn), tối đa 100.
 * Mẫu số tối thiểu 3 để một quán chung giữa hai người chỉ lưu một quán không thành 100%.
 */
final class FitScore {

  static final int MIN_DENOMINATOR = 3;

  private FitScore() {}

  /** {@code mine}, {@code theirs}: số quán (từ Khám phá quán) trong My place của mỗi người. */
  static int of(int shared, int mine, int theirs) {
    if (shared <= 0) return 0;
    int denominator = Math.max(MIN_DENOMINATOR, Math.min(mine, theirs));
    return Math.min(100, Math.round(100f * shared / denominator));
  }
}
