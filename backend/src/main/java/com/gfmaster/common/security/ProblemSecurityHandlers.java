package com.gfmaster.common.security;

import com.gfmaster.common.error.ErrorCode;
import com.gfmaster.common.error.GlobalExceptionHandler;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * 401/403 từ Spring Security cũng trả ProblemDetail có {@code code}, để frontend phân biệt
 * TOKEN_EXPIRED (tự refresh) với UNAUTHORIZED.
 */
@Component
public class ProblemSecurityHandlers {

  private final JsonMapper json;

  public ProblemSecurityHandlers(JsonMapper json) {
    this.json = json;
  }

  public AuthenticationEntryPoint entryPoint() {
    return (request, response, ex) -> write(response, codeFor(ex));
  }

  public AccessDeniedHandler accessDenied() {
    return (request, response, ex) -> write(response, ErrorCode.FORBIDDEN);
  }

  public void write(HttpServletResponse response, ErrorCode code) throws IOException {
    write(response, GlobalExceptionHandler.problem(code, code.defaultMessage()));
  }

  public void write(HttpServletResponse response, ProblemDetail problem) throws IOException {
    response.setStatus(problem.getStatus());
    response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
    response.setCharacterEncoding("UTF-8");
    json.writeValue(response.getOutputStream(), problem);
  }

  /** Nimbus báo "Jwt expired at ..." khi token hết hạn. */
  private static ErrorCode codeFor(AuthenticationException ex) {
    String msg = String.valueOf(ex.getMessage()).toLowerCase();
    return msg.contains("expired") ? ErrorCode.TOKEN_EXPIRED : ErrorCode.UNAUTHORIZED;
  }
}
