package com.gfmaster.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Filter chain stateless.
 *
 * <p>TODO(Phase 4): bật JWT resource server và bỏ {@code permitAll()} cho {@code /api/**}. Hiện
 * tại API mở để phát triển Phase 1–3; KHÔNG deploy trạng thái này ra production.
 */
@Configuration(proxyBeanMethods = false)
public class SecurityConfig {

  @Bean
  SecurityFilterChain apiSecurity(HttpSecurity http) throws Exception {
    http.csrf(csrf -> csrf.disable())
        .cors(Customizer.withDefaults())
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .httpBasic(b -> b.disable())
        .formLogin(f -> f.disable())
        .authorizeHttpRequests(
            auth ->
                auth.requestMatchers("/actuator/health/**", "/actuator/info")
                    .permitAll()
                    .requestMatchers("/api/docs/**", "/v3/api-docs/**", "/swagger-ui/**")
                    .permitAll()
                    .requestMatchers("/api/**", "/uploads/**")
                    .permitAll()
                    .anyRequest()
                    .denyAll());
    return http.build();
  }

  @Bean
  CorsConfigurationSource corsConfigurationSource(GfmProperties props) {
    var cors = new CorsConfiguration();
    cors.setAllowedOrigins(props.corsOrigins());
    cors.addAllowedMethod("*");
    cors.addAllowedHeader("*");
    cors.setAllowCredentials(true);
    cors.addExposedHeader("Retry-After");
    var source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/api/**", cors);
    return source;
  }
}
