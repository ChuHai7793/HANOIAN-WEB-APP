package com.gfmaster.profile;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

/**
 * Hồ sơ cá nhân, quan hệ 1–1 với users qua khoá chính {@code user_id} (không dùng BaseEntity vì id
 * không tự sinh mà chính là id của user). {@code version == null} = chưa lưu lần nào.
 */
@Entity
@Table(name = "user_profiles")
@Getter
@Setter
public class UserProfile {

  @Id
  @Column(name = "user_id")
  private UUID userId;

  @Column(length = 1024)
  private String avatarUrl;

  private LocalDate birthday;

  @Enumerated(EnumType.STRING)
  @JdbcTypeCode(SqlTypes.VARCHAR)
  @Column(length = 10)
  private Gender gender;

  @Column(length = 20)
  private String phone;

  @Column(length = 80)
  private String city;

  @Column(nullable = false, columnDefinition = "text")
  private String bio = "";

  private Instant completedAt;

  /** "Tìm đối tượng": hiện hồ sơ cho người khác quẹt. Chỉ bật được khi có ảnh và đủ 18 tuổi. */
  @Column(nullable = false)
  private boolean datingEnabled;

  /** Bộ lọc khi quẹt: muốn gặp ai */
  @Enumerated(EnumType.STRING)
  @JdbcTypeCode(SqlTypes.VARCHAR)
  @Column(nullable = false, length = 10)
  private DatingInterest interestedIn = DatingInterest.all;

  @JdbcTypeCode(SqlTypes.SMALLINT)
  @Column(nullable = false)
  private int ageMin = 18;

  @JdbcTypeCode(SqlTypes.SMALLINT)
  @Column(nullable = false)
  private int ageMax = 99;

  @Column(nullable = false)
  private boolean sameCityOnly;

  /** Admin khoá khỏi "Tìm đối tượng": không hiện với ai, không quẹt được. */
  @Column(nullable = false)
  private boolean datingBanned;

  /** Ảnh thêm (ngoài ảnh đại diện), tối đa 6, dạng lưu /uploads/<key> */
  @ElementCollection
  @CollectionTable(name = "profile_photos", joinColumns = @JoinColumn(name = "user_id"))
  @OrderColumn(name = "position")
  @Column(name = "url", nullable = false, length = 1024)
  private List<String> photos = new ArrayList<>();

  @ElementCollection
  @CollectionTable(name = "profile_interests", joinColumns = @JoinColumn(name = "user_id"))
  @OrderColumn(name = "position")
  @Column(name = "interest", nullable = false, length = 30)
  private List<String> interests = new ArrayList<>();

  @CreationTimestamp
  @Column(nullable = false, updatable = false)
  private Instant createdAt;

  @UpdateTimestamp
  @Column(nullable = false)
  private Instant updatedAt;

  @Version
  @Column(nullable = false)
  private Long version;
}
