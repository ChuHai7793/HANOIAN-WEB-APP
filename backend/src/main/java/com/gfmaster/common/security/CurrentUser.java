package com.gfmaster.common.security;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Tiêm {@code UUID userId} của người dùng hiện tại vào tham số controller. {@code required = false}: API công
 * khai, khách chưa đăng nhập nhận {@code null} thay vì 401.
 */
@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
public @interface CurrentUser {
  boolean required() default true;
}
