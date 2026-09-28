package com.gfmaster.config;

import com.gfmaster.stats.StatsService;
import com.gfmaster.stats.StatsService.StatsResponse;
import java.time.Duration;
import org.springframework.boot.cache.autoconfigure.RedisCacheManagerBuilderCustomizer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.CacheKeyPrefix;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.serializer.JacksonJsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext.SerializationPair;
import tools.jackson.databind.json.JsonMapper;

/**
 * Spring Cache trên Redis. Key có dạng {@code cache:<tên cache>::<key>}. Mỗi cache dùng serializer
 * JSON gắn đúng kiểu, không lưu tên class Java vào Redis (tránh lỗ hổng deserialize kiểu tuỳ ý).
 */
@Configuration(proxyBeanMethods = false)
@EnableCaching
public class CacheConfig {

  @Bean
  RedisCacheManagerBuilderCustomizer gfmCaches(JsonMapper json) {
    RedisCacheConfiguration defaults =
        RedisCacheConfiguration.defaultCacheConfig()
            .computePrefixWith(CacheKeyPrefix.prefixed("cache:"))
            .disableCachingNullValues();
    return builder ->
        builder
            .cacheDefaults(defaults.entryTtl(Duration.ofMinutes(10)))
            .withCacheConfiguration(
                StatsService.CACHE,
                defaults
                    .entryTtl(Duration.ofMinutes(10))
                    .serializeValuesWith(
                        SerializationPair.fromSerializer(
                            new JacksonJsonRedisSerializer<>(json, StatsResponse.class))));
  }
}
