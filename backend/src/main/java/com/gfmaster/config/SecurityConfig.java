package com.gfmaster.config;

import com.gfmaster.common.security.ProblemSecurityHandlers;
import com.gfmaster.common.web.IdempotencyFilter;
import com.gfmaster.common.web.RateLimitFilter;
import com.gfmaster.common.web.RateLimiter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import tools.jackson.databind.json.JsonMapper;

/**
 * Stateless, xác thực bằng Bearer JWT. CSRF tắt vì API không dùng cookie để xác thực; riêng
 * /auth/refresh và /auth/logout dùng cookie SameSite=Strict + kiểm tra Origin (AuthController).
 */
@Configuration(proxyBeanMethods = false)
public class SecurityConfig {

  @Bean
  SecurityFilterChain apiSecurity(
      HttpSecurity http,
      ProblemSecurityHandlers problems,
      RateLimiter limiter,
      StringRedisTemplate redis,
      JsonMapper json,
      GfmProperties props)
      throws Exception {
    http.csrf(csrf -> csrf.disable())
        .cors(Customizer.withDefaults())
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .httpBasic(b -> b.disable())
        .formLogin(f -> f.disable())
        .authorizeHttpRequests(
            auth ->
                auth.requestMatchers("/error")
                    .permitAll()
                    .requestMatchers("/actuator/health/**", "/actuator/health", "/actuator/info")
                    .permitAll()
                    .requestMatchers("/api/docs/**", "/v3/api-docs/**", "/swagger-ui/**")
                    .permitAll()
                    .requestMatchers(
                        HttpMethod.POST,
                        "/api/v1/auth/register",
                        "/api/v1/auth/login",
                        "/api/v1/auth/refresh",
                        "/api/v1/auth/logout")
                    .permitAll()
                    // Ảnh hiển thị qua <img> nên không kèm được Bearer; tên file là UUID khó đoán
                    .requestMatchers(HttpMethod.GET, "/uploads/**")
                    .permitAll()
                    .requestMatchers("/api/**")
                    .authenticated()
                    .anyRequest()
                    .denyAll())
        .oauth2ResourceServer(
            oauth ->
                oauth
                    .jwt(Customizer.withDefaults())
                    .authenticationEntryPoint(problems.entryPoint())
                    .accessDeniedHandler(problems.accessDenied()))
        .exceptionHandling(
            e -> e.authenticationEntryPoint(problems.entryPoint()).accessDeniedHandler(problems.accessDenied()));
    // Thứ tự: xác thực JWT → rate limit → idempotency (cả hai cần userId)
    http.addFilterAfter(new RateLimitFilter(limiter, problems, props), BearerTokenAuthenticationFilter.class)
        .addFilterAfter(new IdempotencyFilter(redis, json, problems, props), RateLimitFilter.class);
    return http.build();
  }

  @Bean
  PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(12);
  }

  @Bean
  CorsConfigurationSource corsConfigurationSource(GfmProperties props) {
    var cors = new CorsConfiguration();
    cors.setAllowedOrigins(props.corsOrigins());
    cors.addAllowedMethod("*");
    cors.addAllowedHeader("*");
    cors.setAllowCredentials(true);
    cors.addExposedHeader("Retry-After");
    cors.addExposedHeader(IdempotencyFilter.REPLAYED_HEADER);
    var source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/api/**", cors);
    return source;
  }
}
