package com.gfmaster.catalog;

import com.gfmaster.place.PlaceType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

/** Một quán trong "Khám phá quán". Chỉ hệ thống ghi (lúc nhập), người dùng chỉ đọc. */
@Entity
@Table(name = "place_catalog")
@Getter
@Setter
public class CatalogPlace {

  @Id
  @UuidGenerator
  private UUID id;

  @Column(nullable = false, length = 20)
  private String source;

  @Column(nullable = false, length = 40)
  private String externalId;

  @Enumerated(EnumType.STRING)
  @JdbcTypeCode(SqlTypes.VARCHAR)
  @Column(nullable = false, length = 20)
  private PlaceType type;

  @Column(nullable = false, length = 255)
  private String name;

  @Column(length = 500)
  private String address;

  @Column(length = 30)
  private String district;

  @Column(nullable = false, precision = 9, scale = 6)
  private BigDecimal lat;

  @Column(nullable = false, precision = 9, scale = 6)
  private BigDecimal lng;

  @Column(length = 255)
  private String openingHours;

  @Column(length = 100)
  private String cuisine;

  @Column(length = 50)
  private String phone;

  @Column(length = 500)
  private String website;

  private Boolean hasWifi;

  @Column(nullable = false)
  private Instant fetchedAt;

  @CreationTimestamp
  @Column(nullable = false, updatable = false)
  private Instant createdAt;

  @UpdateTimestamp
  @Column(nullable = false)
  private Instant updatedAt;
}
