package com.gfmaster.placelink;

import com.gfmaster.common.entity.BaseEntity;
import com.gfmaster.girlfriend.Girlfriend;
import com.gfmaster.place.Place;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDate;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import org.hibernate.type.SqlTypes;

/** Người yêu ↔ quán đã đi cùng. Xoá place/girlfriend thì DB tự cascade (không map OneToMany). */
@Entity
@Table(name = "place_links")
@Getter
@Setter
public class PlaceLink extends BaseEntity {

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "girlfriend_id", nullable = false, updatable = false)
  @OnDelete(action = OnDeleteAction.CASCADE)
  private Girlfriend girlfriend;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "place_id", nullable = false, updatable = false)
  @OnDelete(action = OnDeleteAction.CASCADE)
  private Place place;

  @JdbcTypeCode(SqlTypes.SMALLINT)
  @Column(nullable = false)
  private int herRating;

  private LocalDate lastVisitedAt;

  @Column(nullable = false, columnDefinition = "text")
  private String memory = "";
}
