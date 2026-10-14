package com.gfmaster.spot;

import com.gfmaster.catalog.CatalogDistrict;
import com.gfmaster.common.entity.BaseEntity;
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

  /** Nhãn kiểu hẹn (cho Autoplan) và nguồn của nhãn, xem V15 / {@link VibeDefaults#resolve}. */
  @Convert(converter = VibeConverters.VibesConverter.class)
  @Column(nullable = false, length = 40)
  private Set<Vibe> vibes = EnumSet.noneOf(Vibe.class);

  @Convert(converter = VibeConverters.SourceConverter.class)
  @Column(nullable = false, length = 10)
  private VibeSource vibesSource = VibeSource.DEFAULT;

  /** Ảnh, tối đa 6, ảnh số 0 là ảnh bìa (= {@code imageUrl}); dạng lưu /uploads/<key> hoặc link http(s) */
  @ElementCollection
  @CollectionTable(name = "spot_photos", joinColumns = @JoinColumn(name = "spot_id"))
  @OrderColumn(name = "position")
  @Column(name = "url", nullable = false, length = 1024)
  @BatchSize(size = 50)
  private List<String> photos = new ArrayList<>();

  /** Điểm đánh giá công khai (V21): ReviewService cập nhật bằng SQL, JPA chỉ đọc. NULL = chưa có đánh giá */
  @Column(name = "rating_avg", insertable = false, updatable = false)
  private BigDecimal ratingAvg;

  @Column(name = "rating_count", insertable = false, updatable = false)
  private int ratingCount;
}
