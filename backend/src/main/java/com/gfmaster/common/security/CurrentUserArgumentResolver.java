package com.gfmaster.common.security;

import com.gfmaster.auth.JwtService;
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

/**
 * Lấy id từ JWT đã được xác thực, không bao giờ tin id client gửi:
 *
 * <ul>
 *   <li>{@link CurrentUser}: claim {@code sub}, người đang đăng nhập (dùng cho /auth/me, logout-all).
 *   <li>{@link DataOwner}: claim {@code own}, chủ dữ liệu (admin); token cũ không có claim này thì
 *       dùng {@code sub}.
 *   <li>{@link MyPlaceOwner}: guest dùng {@code sub} (My place riêng), admin / subadmin dùng {@code own}.
 * </ul>
 */
@Component
public class CurrentUserArgumentResolver implements HandlerMethodArgumentResolver {

  @Override
  public boolean supportsParameter(MethodParameter parameter) {
    return (parameter.hasParameterAnnotation(CurrentUser.class)
            || parameter.hasParameterAnnotation(DataOwner.class)
            || parameter.hasParameterAnnotation(MyPlaceOwner.class))
        && UUID.class.equals(parameter.getParameterType());
  }

  @Override
  public UUID resolveArgument(
      MethodParameter parameter,
      ModelAndViewContainer mavContainer,
      NativeWebRequest request,
      WebDataBinderFactory binderFactory) {
    MyPlaceOwner myPlace = parameter.getParameterAnnotation(MyPlaceOwner.class);
    UUID userId;
    boolean required;
    if (myPlace != null) {
      userId = isGuest() ? currentUserId() : dataOwnerId();
      required = myPlace.required();
    } else {
      userId = parameter.hasParameterAnnotation(DataOwner.class) ? dataOwnerId() : currentUserId();
      CurrentUser current = parameter.getParameterAnnotation(CurrentUser.class);
      required = current == null || current.required();
    }
    if (userId == null && required) {
      throw new ApiException(ErrorCode.UNAUTHORIZED);
    }
    return userId;
  }

  /** Chủ dữ liệu của request hiện tại; null nếu chưa đăng nhập. */
  public static UUID dataOwnerId() {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
      String owner = jwt.getClaimAsString(JwtService.DATA_OWNER_CLAIM);
      if (owner == null) return currentUserId();
      try {
        return UUID.fromString(owner);
      } catch (IllegalArgumentException e) {
        return null;
      }
    }
    return null;
  }

  private static boolean isGuest() {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    return auth != null
        && auth.getPrincipal() instanceof Jwt jwt
        && "GUEST".equals(jwt.getClaimAsString(JwtService.ROLE_CLAIM));
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
