package com.gfmaster.common.web;

import java.util.Set;
import java.util.function.Consumer;

/**
 * Body của một PATCH: giá trị đã parse + tập tên field thực sự có trong JSON. Nhờ đó phân biệt
 * được "không gửi" (giữ nguyên) với "gửi null" (xoá giá trị).
 */
public record Patch<T>(T value, Set<String> fields) {

  public boolean has(String field) {
    return fields.contains(field);
  }

  /** Field bắt buộc: chỉ ghi khi có mặt và khác null. */
  public <V> Patch<T> set(String field, V newValue, Consumer<V> setter) {
    if (has(field) && newValue != null) {
      setter.accept(newValue);
    }
    return this;
  }

  /** Field tuỳ chọn: có mặt là ghi, kể cả null (xoá giá trị). */
  public <V> Patch<T> setNullable(String field, V newValue, Consumer<V> setter) {
    if (has(field)) {
      setter.accept(newValue);
    }
    return this;
  }
}
