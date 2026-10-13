package com.gfmaster.common.security;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Tiêm {@code UUID} của người sở hữu <b>My place</b> (quán và chỗ chơi đã lưu): guest có My place riêng
 * (claim {@code sub}), admin và subadmin dùng My place của chủ dữ liệu (claim {@code own}).
 */
@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
public @interface MyPlaceOwner {
  /** false: khách chưa đăng nhập nhận {@code null} thay vì 401 (API công khai). */
  boolean required() default true;
}
