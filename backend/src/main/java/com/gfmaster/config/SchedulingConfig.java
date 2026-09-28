package com.gfmaster.config;

import net.javacrumbs.shedlock.core.LockProvider;
import net.javacrumbs.shedlock.provider.redis.spring.RedisLockProvider;
import net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Bật {@code @Scheduled}. Chạy nhiều instance thì mỗi job vẫn chỉ chạy một nơi: ShedLock giữ khoá
 * {@code shedlock:gfm:<tên job>} trong Redis trong lúc job chạy.
 */
@Configuration(proxyBeanMethods = false)
@EnableScheduling
@EnableSchedulerLock(defaultLockAtMostFor = "10m")
public class SchedulingConfig {

  @Bean
  LockProvider lockProvider(RedisConnectionFactory connectionFactory) {
    return new RedisLockProvider(connectionFactory, "gfm", "shedlock");
  }
}
