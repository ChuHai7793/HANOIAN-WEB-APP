package com.gfmaster.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.unit.DataSize;
import org.springframework.validation.annotation.Validated;

/** Cấu hình riêng của app ({@code gfm.*}). Thiếu secret thì app không khởi động. */
@Validated
@ConfigurationProperties("gfm")
public record GfmProperties(
    @Valid @NotNull Jwt jwt,
    @Valid @NotNull Auth auth,
    @Valid @NotNull RateLimit rateLimit,
    @Valid @NotNull Idempotency idempotency,
    @NotNull List<String> corsOrigins,
    @Valid @NotNull Storage storage,
    @Valid @NotNull Messaging messaging,
    @Valid @NotNull Jobs jobs,
    @Valid @NotNull Importer importer,
    @Valid @NotNull Mongo mongo) {

  public record Jwt(
      @NotBlank @Size(min = 32, message = "JWT_SECRET phải dài ít nhất 32 byte") String secret,
      @NotNull Duration accessTtl,
      @NotNull Duration refreshTtl) {}

  /** {@code cookieSecure=false} chỉ dùng ở dev chạy http. */
  public record Auth(boolean cookieSecure) {}

  /** Số request tối đa mỗi phút: auth theo IP, API chung theo user, giải link Maps theo user. */
  public record RateLimit(@Min(1) int authPerMinute, @Min(1) int apiPerMinute, @Min(1) int mapsPerMinute) {}

  /** Response đã xử lý được giữ {@code ttl}; khoá "đang xử lý" tự hết hạn sau {@code inProgressTtl}. */
  public record Idempotency(@NotNull Duration ttl, @NotNull Duration inProgressTtl) {}

  /**
   * Hai vùng lưu: <b>public</b> (ảnh đã xử lý, phục vụ qua {@code publicBaseUrl}, sau CDN) và
   * <b>incoming</b> (ảnh gốc trình duyệt upload thẳng lên, riêng tư, chưa xử lý nên có thể còn GPS
   * hoặc không phải ảnh). Driver local: hai thư mục; chỉ {@code localDir} được phục vụ qua /uploads.
   */
  public record Storage(
      @NotBlank @Pattern(regexp = "local|s3") String driver,
      @NotBlank String localDir,
      @NotBlank String localIncomingDir,
      @NotBlank String publicBaseUrl,
      @NotNull DataSize maxUploadSize,
      S3 s3) {}

  /**
   * S3-compatible (Cloudflare R2, AWS S3, MinIO). {@code bucket}: ảnh công khai; {@code
   * incomingBucket}: ảnh gốc, riêng tư. {@code pathStyle=true} cho MinIO. Region của R2 là "auto".
   */
  public record S3(
      String endpoint,
      String region,
      String bucket,
      String incomingBucket,
      String accessKey,
      String secretKey,
      boolean pathStyle) {}

  public record Messaging(boolean enabled) {}

  /** Import dữ liệu localStorage cũ. {@code maxSize} phải nhỏ hơn max_allowed_packet của MariaDB (16MB). */
  public record Importer(@NotNull DataSize maxSize, @NotNull Duration lockTtl) {}

  /** Job định kỳ. {@code cron} theo cú pháp Spring (giây phút giờ ngày tháng thứ). */
  public record Jobs(@Valid @NotNull OrphanUploads orphanUploads) {}

  /** Ảnh upload quá {@code olderThan} mà không quán/người yêu nào dùng thì bị xoá. */
  public record OrphanUploads(@NotBlank String cron, @NotNull Duration olderThan) {}

  public record Mongo(boolean enabled) {}
}
