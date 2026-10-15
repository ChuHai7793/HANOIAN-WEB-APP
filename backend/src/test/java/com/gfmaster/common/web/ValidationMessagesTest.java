package com.gfmaster.common.web;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.constraints.Size;
import org.junit.jupiter.api.Test;

/** ValidationMessages.properties: thông báo tiếng Việt cho @Size, cả khi có và không có độ dài tối thiểu. */
class ValidationMessagesTest {

  private static final Validator VALIDATOR = Validation.buildDefaultValidatorFactory().getValidator();

  record Form(@Size(max = 5) String note, @Size(min = 2, max = 5) String name) {}

  private static String message(Form form, String field) {
    return VALIDATOR.validate(form).stream()
        .filter(v -> v.getPropertyPath().toString().equals(field))
        .map(ConstraintViolation::getMessage)
        .findFirst()
        .orElseThrow();
  }

  @Test
  void sizeWithoutMinimum() {
    assertThat(message(new Form("quá dài rồi", "ab"), "note")).isEqualTo("tối đa 5 ký tự");
  }

  @Test
  void sizeWithMinimum() {
    assertThat(message(new Form("ok", "a"), "name")).isEqualTo("từ 2 đến 5 ký tự");
  }
}
