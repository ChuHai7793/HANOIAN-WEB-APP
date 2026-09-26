package com.gfmaster.common.web;

import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.error.ErrorCode;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Đọc body PATCH dạng JSON thô thành {@link Patch}, chạy Bean Validation như {@code @Valid}. */
@Component
public class PatchReader {

  private final JsonMapper mapper;
  private final Validator validator;

  public PatchReader(JsonMapper mapper, Validator validator) {
    this.mapper = mapper;
    this.validator = validator;
  }

  public <T> Patch<T> read(JsonNode body, Class<T> type) {
    if (body == null || !body.isObject()) {
      throw new ApiException(ErrorCode.MALFORMED_REQUEST, "Body PATCH phải là một JSON object.");
    }
    T value;
    try {
      value = mapper.treeToValue(body, type);
    } catch (JacksonException e) {
      throw new ApiException(ErrorCode.MALFORMED_REQUEST, e.getOriginalMessage());
    }
    Set<ConstraintViolation<T>> violations = validator.validate(value);
    if (!violations.isEmpty()) {
      List<Map<String, String>> errors =
          violations.stream()
              .sorted(Comparator.comparing(v -> v.getPropertyPath().toString()))
              .map(v -> Map.of("field", v.getPropertyPath().toString(), "message", v.getMessage()))
              .toList();
      throw new ApiException(ErrorCode.VALIDATION_FAILED).with("errors", errors);
    }
    return new Patch<>(value, new LinkedHashSet<>(body.propertyNames()));
  }
}
