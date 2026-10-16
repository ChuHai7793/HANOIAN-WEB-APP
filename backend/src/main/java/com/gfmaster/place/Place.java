package com.gfmaster.place;

import com.gfmaster.common.entity.OwnedEntity;
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
import java.util.UUID;

@Entity
@Table(name = "places")
@Getter
@Setter
public class Place extends OwnedEntity {

  // VARCHAR + CHECK trong DB, không dùng kiểu ENUM native của DB
  @Enumerated(EnumType.STRING)
  @JdbcTypeCode(SqlTypes.VARCHAR)
  @Column(nullable = false, length = 20)
  private PlaceType type;

  @Column(nullable = false, length = 120)
  private String name;

  @Column(nullable = false)
  private String address = "";

  @Enumerated(EnumType.STRING)
  @JdbcTypeCode(SqlTypes.VARCHAR)
  @Column(nullable = false, length = 20)
  private PriceRange priceRange;

  /** Giá cụ thể VNĐ/người; null = chưa nhập (chỉ có nhóm giá) */
  private Integer priceFrom;

  /** null = chỉ có giá từ */
  private Integer priceTo;

  @JdbcTypeCode(SqlTypes.SMALLINT)
  @Column(nullable = false)
  private int rating;

  @Column(nullable = false)
  private LocalTime openTime;

  @Column(nullable = false)
  private LocalTime closeTime;

  @Column(nullable = false, length = 1024)
  private String imageUrl = "";

  @Column(nullable = false, columnDefinition = "text")
  private String note = "";

  @Column(nullable = false, length = 2048)
  private String googleMapsUrl = "";

  @Column(precision = 9, scale = 6)
  private BigDecimal lat;

  @Column(precision = 9, scale = 6)
  private BigDecimal lng;

  private Boolean hasWifi;

  private Boolean hasParking;

  @Column(length = 50)
  private String cuisine;

  /**
   * Quán trong "My place" được sao chép từ "Khám phá quán" (null với quán cũ tự nhập). Admin sửa quán
   * trong danh mục thì bản sao cập nhật theo; xoá quán trong danh mục thì giữ bản sao (thành null).
   */
  @Column(name = "catalog_id")
  private UUID catalogId;
}
