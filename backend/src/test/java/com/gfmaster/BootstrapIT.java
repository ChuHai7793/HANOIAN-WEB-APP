package com.gfmaster;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gfmaster.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

/** Tiêu chí hoàn thành Phase 1: Flyway + Hibernate validate chạy qua, health xanh, có Swagger. */
@IntegrationTest
class BootstrapIT {

  @Autowired MockMvc mvc;
  @Autowired JdbcTemplate jdbc;

  @Test
  void flywayCreatesAllTables() {
    var tables =
        jdbc.queryForList(
            "select table_name from information_schema.tables where table_schema = current_schema()",
            String.class);
    assertThat(tables)
        .contains(
            "users", "places", "girlfriends", "girlfriend_hobbies", "place_links", "uploads",
            "import_jobs", "flyway_schema_history");
  }

  @Test
  void healthReportsDbRedisRabbitUp() throws Exception {
    mvc.perform(get("/actuator/health"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("UP"))
        .andExpect(jsonPath("$.components.db.status").value("UP"))
        .andExpect(jsonPath("$.components.redis.status").value("UP"))
        .andExpect(jsonPath("$.components.rabbit.status").value("UP"));
  }

  @Test
  void swaggerDocsAvailable() throws Exception {
    mvc.perform(get("/api/docs/openapi.json"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.info.title").value("GF Master API"));
  }

  @Test
  void unknownRoutesAreDenied() throws Exception {
    mvc.perform(get("/actuator/env"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
  }
}
