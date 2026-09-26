package com.gfmaster.girlfriend;

import com.gfmaster.common.entity.OwnedEntity;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "girlfriends")
@Getter
@Setter
public class Girlfriend extends OwnedEntity {

  @Column(nullable = false, length = 80)
  private String name;

  @Column(nullable = false, length = 80)
  private String nickname = "";

  @Column(nullable = false, length = 1024)
  private String avatarUrl = "";

  private LocalDate birthday;

  @Column(nullable = false, length = 20)
  private String phone = "";

  @Enumerated(EnumType.STRING)
  @JdbcTypeCode(SqlTypes.VARCHAR)
  @Column(nullable = false, length = 20)
  private RelationshipStatus status = RelationshipStatus.dating;

  private LocalDate startedDate;

  @Column(nullable = false, columnDefinition = "text")
  private String note = "";

  @ElementCollection
  @CollectionTable(name = "girlfriend_hobbies", joinColumns = @JoinColumn(name = "girlfriend_id"))
  @OrderColumn(name = "position")
  @Column(name = "hobby", nullable = false, length = 50)
  private List<String> hobbies = new ArrayList<>();
}
