package com.gfmaster.importer.dto;

import com.gfmaster.importer.ImportJobStatus;
import java.time.Instant;
import java.util.UUID;
import tools.jackson.databind.JsonNode;

/** {@code stats} chỉ có khi DONE, {@code error} chỉ có khi FAILED. */
public record ImportJobResponse(
    UUID id, ImportJobStatus status, JsonNode stats, String error, Instant createdAt, Instant finishedAt) {}
