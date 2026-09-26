package com.gfmaster;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.mariadb.MariaDBContainer;
import org.testcontainers.rabbitmq.RabbitMQContainer;
import org.testcontainers.utility.DockerImageName;

/** Cùng phiên bản image với docker-compose.yml. */
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

  @Bean
  @ServiceConnection
  MariaDBContainer mariaDbContainer() {
    return new MariaDBContainer(DockerImageName.parse("mariadb:11.4"))
        .withCommand("--character-set-server=utf8mb4", "--collation-server=utf8mb4_uca1400_ai_ci");
  }

  @Bean
  @ServiceConnection
  RabbitMQContainer rabbitContainer() {
    return new RabbitMQContainer(DockerImageName.parse("rabbitmq:4-management-alpine"));
  }

  @Bean
  @ServiceConnection(name = "redis")
  GenericContainer<?> redisContainer() {
    return new GenericContainer<>(DockerImageName.parse("redis:7-alpine")).withExposedPorts(6379);
  }
}
