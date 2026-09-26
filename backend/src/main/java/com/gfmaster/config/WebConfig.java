package com.gfmaster.config;

import com.gfmaster.common.security.CurrentUserArgumentResolver;
import com.gfmaster.upload.storage.LocalStorageDriver;
import java.time.Duration;
import java.util.List;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration(proxyBeanMethods = false)
public class WebConfig implements WebMvcConfigurer {

  private final CurrentUserArgumentResolver currentUserResolver;
  private final ObjectProvider<LocalStorageDriver> localStorage;

  public WebConfig(
      CurrentUserArgumentResolver currentUserResolver, ObjectProvider<LocalStorageDriver> localStorage) {
    this.currentUserResolver = currentUserResolver;
    this.localStorage = localStorage;
  }

  @Override
  public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
    resolvers.add(currentUserResolver);
  }

  /** Driver local: phục vụ ảnh đã upload tại /uploads/**. Tên file là UUID nên cache lâu được. */
  @Override
  public void addResourceHandlers(ResourceHandlerRegistry registry) {
    localStorage.ifAvailable(
        driver ->
            registry
                .addResourceHandler("/uploads/**")
                .addResourceLocations(driver.root().toUri().toString())
                .setCacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable()));
  }
}
