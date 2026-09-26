package com.gfmaster.upload.dto;

import com.gfmaster.upload.UploadStatus;
import java.util.UUID;

public record UploadResponse(
    UUID id, String url, String thumbUrl, int width, int height, int sizeBytes, UploadStatus status) {}
