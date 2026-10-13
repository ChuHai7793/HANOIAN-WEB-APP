package com.gfmaster.catalog;

import com.gfmaster.common.entity.BaseEntity;
import com.gfmaster.place.PlaceType;
import com.gfmaster.place.PriceRange;
import com.gfmaster.vibe.Vibe;
import com.gfmaster.vibe.VibeConverters;
import com.gfmaster.vibe.VibeDefaults;
import com.gfmaster.vibe.VibeSource;
import jakarta.persistence.Convert;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.EnumSet;
import java.util.Set;
import java.time.LocalTime;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.BatchSize;

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

  /** Nhãn kiểu hẹn (cho Autoplan) và nguồn của nhãn, xem V15 / {@link VibeDefaults#resolve}. */
  @Convert(converter = VibeConverters.VibesConverter.class)
  @Column(nullable = false, length = 40)
  private Set<Vibe> vibes = EnumSet.noneOf(Vibe.class);

  @Convert(converter = VibeConverters.SourceConverter.class)
  @Column(nullable = false, length = 10)
  private VibeSource vibesSource = VibeSource.DEFAULT;

  /** Ảnh, tối đa 6, ảnh số 0 là ảnh bìa (= {@code imageUrl}); dạng lưu /uploads/<key> hoặc link http(s) */
  @ElementCollection
  @CollectionTable(name = "catalog_photos", joinColumns = @JoinColumn(name = "catalog_id"))
  @OrderColumn(name = "position")
  @Column(name = "url", nullable = false, length = 1024)
  @BatchSize(size = 50)
  private List<String> photos = new ArrayList<>();
}
