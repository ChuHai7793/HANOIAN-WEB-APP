package com.gfmaster.common.jpa;

import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import java.time.LocalTime;

/** Điều kiện "đang mở cửa lúc t" cho bộ lọc (quán, chỗ chơi), kể cả giờ mở qua nửa đêm. */
public final class OpenHours {

  private OpenHours() {}

  /**
   * open ≤ t < close trong ngày, hoặc t ≥ open / t < close khi đóng cửa qua nửa đêm (close < open).
   * {@code nullMeansOpen}: không có giờ cố định (openTime null) thì tính là đang mở.
   */
  public static Predicate isOpenAt(
      CriteriaBuilder cb, Expression<LocalTime> openTime, Expression<LocalTime> closeTime, LocalTime at, boolean nullMeansOpen) {
    // So bằng số giây trong ngày: bind thẳng LocalTime vào điều kiện bị quy đổi qua jdbc.time_zone=UTC
    // nên lệch theo múi giờ của JVM (10:00 thành 03:00 ở UTC+7)
    var open = secondOfDay(cb, openTime);
    var close = secondOfDay(cb, closeTime);
    Expression<Double> t = cb.literal((double) at.toSecondOfDay());
    Predicate sameDay = cb.and(cb.lessThanOrEqualTo(open, close), cb.lessThanOrEqualTo(open, t), cb.greaterThan(close, t));
    Predicate overnight = cb.and(cb.greaterThan(open, close), cb.or(cb.lessThanOrEqualTo(open, t), cb.greaterThan(close, t)));
    return nullMeansOpen ? cb.or(cb.isNull(openTime), sameDay, overnight) : cb.or(sameDay, overnight);
  }

  /** Postgres date_part('epoch', time): số giây tính từ 00:00 */
  private static Expression<Double> secondOfDay(CriteriaBuilder cb, Expression<LocalTime> time) {
    return cb.function("date_part", Double.class, cb.literal("epoch"), time);
  }
}
