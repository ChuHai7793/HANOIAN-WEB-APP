package com.gfmaster.upload.dto;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Cách trình duyệt gửi ảnh gốc: {@code method} (PUT) tới {@code uploadUrl} kèm đúng {@code headers},
 * trước {@code expiresAt}; xong thì gọi {@code POST /api/v1/uploads/{id}/complete}.
 */
public record DirectUploadResponse(
    UUID id, String uploadUrl, String method, Map<String, String> headers, Instant expiresAt) {}
