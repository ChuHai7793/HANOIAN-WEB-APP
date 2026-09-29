package com.gfmaster.upload.dto;

import com.gfmaster.upload.UploadStatus;
import java.util.UUID;

/** {@code url}, {@code thumbUrl}, {@code width}, {@code height} là null cho tới khi xử lý xong. */
public record UploadResponse(
    UUID id, String url, String thumbUrl, Integer width, Integer height, int sizeBytes, UploadStatus status) {}
