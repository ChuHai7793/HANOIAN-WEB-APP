package com.gfmaster.config;

import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalTime;
import org.springframework.boot.jackson.autoconfigure.JsonMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Định dạng JSON khớp với frontend: {@code LocalDate} → "yyyy-MM-dd" (mặc định ISO),
 * {@code LocalTime} → "HH:mm" (frontend dùng input type=time, không có giây).
 */
@Configuration(proxyBeanMethods = false)
public class JacksonConfig {

  @Bean
  JsonMapperBuilderCustomizer timeFormatCustomizer() {
    return builder ->
        builder.withConfigOverride(
            LocalTime.class, o -> o.setFormat(JsonFormat.Value.forPattern("HH:mm")));
  }
}
