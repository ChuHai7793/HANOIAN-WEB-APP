package com.gfmaster.common.error;

import java.util.LinkedHashMap;
import java.util.Map;

/** Lỗi nghiệp vụ có mã. {@code extras} được thêm vào ProblemDetail (ví dụ {@code current}). */
public class ApiException extends RuntimeException {

  private final ErrorCode code;
  private final Map<String, Object> extras = new LinkedHashMap<>();

  public ApiException(ErrorCode code) {
    this(code, code.defaultMessage());
  }

  public ApiException(ErrorCode code, String detail) {
    super(detail);
    this.code = code;
  }

  public static ApiException notFound() {
    return new ApiException(ErrorCode.NOT_FOUND);
  }

  public ApiException with(String key, Object value) {
    extras.put(key, value);
    return this;
  }

  public ErrorCode code() {
    return code;
  }

  public Map<String, Object> extras() {
    return extras;
  }
}
