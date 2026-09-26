package com.gfmaster.common.error;

import java.net.URI;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/** Mọi lỗi trả về dạng ProblemDetail (RFC 9457) kèm trường {@code code}. */
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

  private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
  private static final String TYPE_BASE = "https://gfmaster.app/errors/";

  /** Tên constraint trong V1__init_schema.sql → mã lỗi. */
  private static final Map<String, ErrorCode> CONSTRAINTS =
      Map.of(
          "uk_link_gf_place", ErrorCode.LINK_ALREADY_EXISTS,
          "uk_users_email", ErrorCode.EMAIL_TAKEN);

  public static ProblemDetail problem(ErrorCode code, String detail) {
    ProblemDetail pd = ProblemDetail.forStatusAndDetail(code.status(), detail);
    pd.setType(URI.create(TYPE_BASE + code.slug()));
    pd.setProperty("code", code.name());
    return pd;
  }

  @ExceptionHandler(ApiException.class)
  ResponseEntity<ProblemDetail> handleApi(ApiException ex) {
    ProblemDetail pd = problem(ex.code(), ex.getMessage());
    ex.extras().forEach(pd::setProperty);
    return ResponseEntity.status(ex.code().status()).body(pd);
  }

  @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
  ResponseEntity<ProblemDetail> handleOptimisticLock(ObjectOptimisticLockingFailureException ex) {
    ErrorCode code = ErrorCode.VERSION_CONFLICT;
    return ResponseEntity.status(code.status()).body(problem(code, code.defaultMessage()));
  }

  @ExceptionHandler(DataIntegrityViolationException.class)
  ResponseEntity<ProblemDetail> handleIntegrity(DataIntegrityViolationException ex) {
    String msg = String.valueOf(ex.getMostSpecificCause().getMessage()).toLowerCase();
    ErrorCode code =
        CONSTRAINTS.entrySet().stream()
            .filter(e -> msg.contains(e.getKey()))
            .map(Map.Entry::getValue)
            .findFirst()
            .orElse(ErrorCode.DATA_CONFLICT);
    return ResponseEntity.status(code.status()).body(problem(code, code.defaultMessage()));
  }

  @Override
  protected ResponseEntity<Object> handleMethodArgumentNotValid(
      MethodArgumentNotValidException ex,
      HttpHeaders headers,
      HttpStatusCode status,
      WebRequest request) {
    ProblemDetail pd =
        problem(ErrorCode.VALIDATION_FAILED, ErrorCode.VALIDATION_FAILED.defaultMessage());
    List<Map<String, String>> errors =
        ex.getBindingResult().getFieldErrors().stream()
            .map(fe -> Map.of("field", fe.getField(), "message", String.valueOf(fe.getDefaultMessage())))
            .toList();
    pd.setProperty("errors", errors);
    return ResponseEntity.badRequest().body(pd);
  }

  @Override
  protected ResponseEntity<Object> handleHttpMessageNotReadable(
      HttpMessageNotReadableException ex,
      HttpHeaders headers,
      HttpStatusCode status,
      WebRequest request) {
    ErrorCode code = ErrorCode.MALFORMED_REQUEST;
    return ResponseEntity.badRequest().body(problem(code, code.defaultMessage()));
  }

  @Override
  protected ResponseEntity<Object> handleMaxUploadSizeExceededException(
      MaxUploadSizeExceededException ex,
      HttpHeaders headers,
      HttpStatusCode status,
      WebRequest request) {
    ErrorCode code = ErrorCode.FILE_TOO_LARGE;
    return ResponseEntity.status(code.status()).body(problem(code, code.defaultMessage()));
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<ProblemDetail> handleUnexpected(Exception ex) {
    log.error("Unhandled exception", ex);
    ErrorCode code = ErrorCode.INTERNAL_ERROR;
    return ResponseEntity.status(code.status()).body(problem(code, code.defaultMessage()));
  }
}
