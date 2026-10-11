package com.gfmaster.catalog;

import com.gfmaster.common.entity.BaseEntity;
import com.gfmaster.place.PlaceType;
import com.gfmaster.place.PriceRange;
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

/**
 * Một quán trong "Khám phá quán": admin nhập, mọi người xem. Đủ thông tin như một quán trong My place
 * (vì "Add vào My place" sao chép nguyên quán), thêm khu vực (quận) bắt buộc.
 */
@Entity
@Table(name = "place_catalog")
@Getter
@Setter
public class CatalogPlace extends BaseEntity {

  @Enumerated(EnumType.STRING)
  @JdbcTypeCode(SqlTypes.VARCHAR)
  @Column(nullable = false, length = 20)
  private PlaceType type;

  @Enumerated(EnumType.STRING)
  @JdbcTypeCode(SqlTypes.VARCHAR)
  @Column(nullable = false, length = 30)
  private CatalogDistrict district;

  @Column(nullable = false, length = 120)
  private String name;

  @Column(nullable = false)
  private String address = "";

  @Enumerated(EnumType.STRING)
  @JdbcTypeCode(SqlTypes.VARCHAR)
  @Column(nullable = false, length = 20)
  private PriceRange priceRange;

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
}
