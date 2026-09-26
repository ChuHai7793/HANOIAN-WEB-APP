package com.gfmaster.common.security;

import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.error.ErrorCode;
import com.gfmaster.config.GfmProperties;
import java.util.UUID;
import org.springframework.core.MethodParameter;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

/**
 * Xác định user hiện tại.
 *
 * <p>TODO(Phase 4): lấy {@code sub} từ JWT. Tạm thời (chỉ khi {@code gfm.debug-user-header=true},
 * bật ở dev/test) đọc header {@code X-Debug-User}; thiếu header thì dùng user demo của seed.
 */
@Component
public class CurrentUserArgumentResolver implements HandlerMethodArgumentResolver {

  public static final String DEBUG_HEADER = "X-Debug-User";
  static final UUID DEMO_USER_ID = UUID.fromString("00000000-0000-4000-8000-000000000001");

  private final boolean debugHeaderEnabled;

  public CurrentUserArgumentResolver(GfmProperties props) {
    this.debugHeaderEnabled = props.debugUserHeader();
  }

  @Override
  public boolean supportsParameter(MethodParameter parameter) {
    return parameter.hasParameterAnnotation(CurrentUser.class)
        && UUID.class.equals(parameter.getParameterType());
  }

  @Override
  public UUID resolveArgument(
      MethodParameter parameter,
      ModelAndViewContainer mavContainer,
      NativeWebRequest request,
      WebDataBinderFactory binderFactory) {
    if (!debugHeaderEnabled) {
      throw new ApiException(ErrorCode.UNAUTHORIZED);
    }
    String header = request.getHeader(DEBUG_HEADER);
    if (header == null || header.isBlank()) {
      return DEMO_USER_ID;
    }
    try {
      return UUID.fromString(header.trim());
    } catch (IllegalArgumentException e) {
      throw new ApiException(ErrorCode.UNAUTHORIZED);
    }
  }
}
