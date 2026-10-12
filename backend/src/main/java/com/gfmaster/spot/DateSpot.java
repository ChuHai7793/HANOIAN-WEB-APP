package com.gfmaster.spot;

import com.gfmaster.catalog.CatalogDistrict;
import com.gfmaster.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalTime;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** Một chỗ chơi trong "Tìm chỗ chơi": admin nhập, mọi người xem. */
@Entity
@Table(name = "date_spots")
@Getter
@Setter
public class DateSpot extends BaseEntity {

  @Enumerated(EnumType.STRING)
  @JdbcTypeCode(SqlTypes.VARCHAR)
  @Column(nullable = false, length = 20)
  private SpotCategory category;

  @Enumerated(EnumType.STRING)
  @JdbcTypeCode(SqlTypes.VARCHAR)
  @Column(nullable = false, length = 30)
  private CatalogDistrict district;

  @Column(nullable = false, length = 120)
  private String name;

  @Column(nullable = false)
  private String address = "";

  @Column(nullable = false, columnDefinition = "text")
  private String description = "";

  /** VNĐ/người, 0 = miễn phí */
  @Column(nullable = false)
  private int priceFrom;

  /** null = một mức giá */
  private Integer priceTo;

  /** null (cùng closeTime) = không có giờ cố định */
  private LocalTime openTime;

  private LocalTime closeTime;

  @Column(nullable = false)
  private String hoursNote = "";

  @JdbcTypeCode(SqlTypes.SMALLINT)
  private Integer durationMin;

  @Column(nullable = false)
  private boolean indoor;

  @Column(nullable = false)
  private boolean needsBooking;

  @Column(nullable = false, length = 2048)
  private String bookingUrl = "";

  @Column(nullable = false, length = 1024)
  private String imageUrl = "";

  @Column(nullable = false, length = 2048)
  private String googleMapsUrl = "";

  @Column(precision = 9, scale = 6)
  private BigDecimal lat;

  @Column(precision = 9, scale = 6)
  private BigDecimal lng;
}
