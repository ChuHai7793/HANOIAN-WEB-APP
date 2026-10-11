package com.gfmaster.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

/** Một lượt nhập "Khám phá quán" từ OpenStreetMap. Chạy nền, mỗi ô (quận × loại) xong thì cập nhật. */
@Entity
@Table(name = "catalog_import_runs")
@Getter
@Setter
public class CatalogImportRun {

  public enum Status {
    RUNNING,
    DONE,
    FAILED
  }

  @Id
  @UuidGenerator
  private UUID id;

  private UUID requestedBy;

  @Enumerated(EnumType.STRING)
  @JdbcTypeCode(SqlTypes.VARCHAR)
  @Column(nullable = false, length = 20)
  private Status status;

  /** Mã quận ({@link CatalogDistrict}), ngăn cách bằng dấu phẩy. */
  @Column(nullable = false, length = 500)
  private String districts;

  @Column(nullable = false, length = 100)
  private String types;

  private int totalCells;
  private int doneCells;
  private int added;
  private int updated;

  /** Mỗi dòng một ô bị lỗi. */
  @Column(nullable = false, columnDefinition = "text")
  private String errors = "";

  @Column(nullable = false)
  private Instant startedAt;

  private Instant finishedAt;

  void addError(String line) {
    errors = errors.isEmpty() ? line : errors + "\n" + line;
  }
}
