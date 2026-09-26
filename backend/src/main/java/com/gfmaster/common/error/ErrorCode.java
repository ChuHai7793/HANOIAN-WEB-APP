package com.gfmaster.common.error;

import org.springframework.http.HttpStatus;

/** Mã lỗi trả về trong trường {@code code} của ProblemDetail. Frontend dịch sang tiếng Việt. */
public enum ErrorCode {
  VALIDATION_FAILED(HttpStatus.BAD_REQUEST, "Dữ liệu không hợp lệ."),
  MALFORMED_REQUEST(HttpStatus.BAD_REQUEST, "Request không đọc được."),
  UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "Bạn cần đăng nhập."),
  TOKEN_EXPIRED(HttpStatus.UNAUTHORIZED, "Phiên đăng nhập đã hết hạn."),
  NOT_FOUND(HttpStatus.NOT_FOUND, "Không tìm thấy dữ liệu."),
  VERSION_CONFLICT(HttpStatus.CONFLICT, "Dữ liệu đã bị thay đổi ở thiết bị khác."),
  LINK_ALREADY_EXISTS(HttpStatus.CONFLICT, "Quán này đã được gắn cho người này."),
  EMAIL_TAKEN(HttpStatus.CONFLICT, "Email đã được sử dụng."),
  DATA_CONFLICT(HttpStatus.CONFLICT, "Dữ liệu bị trùng hoặc vi phạm ràng buộc."),
  IDEMPOTENCY_IN_PROGRESS(HttpStatus.CONFLICT, "Yêu cầu đang được xử lý."),
  FILE_TOO_LARGE(HttpStatus.CONTENT_TOO_LARGE, "File quá lớn."),
  UNSUPPORTED_IMAGE(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Chỉ nhận ảnh JPG, PNG hoặc WebP."),
  IMPORT_RUNNING(HttpStatus.LOCKED, "Đang có một lần import khác chạy."),
  RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS, "Bạn thao tác quá nhanh, thử lại sau."),
  INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "Có lỗi xảy ra phía server.");

  private final HttpStatus status;
  private final String defaultMessage;

  ErrorCode(HttpStatus status, String defaultMessage) {
    this.status = status;
    this.defaultMessage = defaultMessage;
  }

  public HttpStatus status() {
    return status;
  }

  public String defaultMessage() {
    return defaultMessage;
  }

  /** Dùng làm URI trong trường {@code type}: VERSION_CONFLICT → version-conflict. */
  public String slug() {
    return name().toLowerCase().replace('_', '-');
  }
}
