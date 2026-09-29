package com.gfmaster.common.security;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Tiêm {@code UUID} của <b>chủ dữ liệu</b> mà người đang đăng nhập làm việc cùng: chính họ nếu là
 * admin, hoặc admin mà họ được gắn vào nếu là guest (claim {@code own} của JWT). Dùng cho API dữ
 * liệu (quán, người yêu...). Chỉ admin mới qua được các request ghi (SecurityConfig).
 */
@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
public @interface DataOwner {}
