package com.gfmaster.common.security;

import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.error.ErrorCode;
import java.util.UUID;
import org.springframework.core.MethodParameter;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

/** userId lấy từ claim {@code sub} của JWT đã được xác thực. Không bao giờ tin userId client gửi. */
@Component
public class CurrentUserArgumentResolver implements HandlerMethodArgumentResolver {

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
    UUID userId = currentUserId();
    if (userId == null) {
      throw new ApiException(ErrorCode.UNAUTHORIZED);
    }
    return userId;
  }

  /** null nếu request chưa đăng nhập. */
  public static UUID currentUserId() {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
      try {
        return UUID.fromString(jwt.getSubject());
      } catch (IllegalArgumentException e) {
        return null;
      }
    }
    return null;
  }
}
