package com.gfmaster.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Cấu hình riêng của app ({@code gfm.*}). Thiếu secret thì app không khởi động. */
@Validated
@ConfigurationProperties("gfm")
public record GfmProperties(
    @Valid @NotNull Jwt jwt,
    @NotNull List<String> corsOrigins,
    @Valid @NotNull Storage storage,
    @Valid @NotNull Messaging messaging,
    @Valid @NotNull Mongo mongo) {

  public record Jwt(
      @NotBlank @Size(min = 32, message = "JWT_SECRET phải dài ít nhất 32 byte") String secret,
      @NotNull Duration accessTtl,
      @NotNull Duration refreshTtl) {}

  public record Storage(
      @NotBlank @Pattern(regexp = "local|s3") String driver,
      @NotBlank String localDir,
      @NotBlank String publicBaseUrl,
      S3 s3) {}

  public record S3(String endpoint, String bucket, String accessKey, String secretKey) {}

  public record Messaging(boolean enabled) {}

  public record Mongo(boolean enabled) {}
}
