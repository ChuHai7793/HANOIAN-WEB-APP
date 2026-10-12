package com.gfmaster.dating;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class FitScoreTest {

  @Test
  void noSharedPlaceIsZero() {
    assertThat(FitScore.of(0, 5, 5)).isZero();
  }

  @Test
  void denominatorIsAtLeastThree() {
    // Hai người chỉ lưu đúng một quán chung: không thành 100%
    assertThat(FitScore.of(1, 1, 1)).isEqualTo(33);
    assertThat(FitScore.of(3, 3, 3)).isEqualTo(100);
  }

  @Test
  void dividesBySmallerCollection() {
    assertThat(FitScore.of(3, 4, 10)).isEqualTo(75);
    assertThat(FitScore.of(2, 5, 4)).isEqualTo(50);
    assertThat(FitScore.of(3, 5, 8)).isEqualTo(60);
  }

  @Test
  void neverAboveHundred() {
    assertThat(FitScore.of(5, 3, 3)).isEqualTo(100);
  }
}
