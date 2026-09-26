package com.gfmaster.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Swagger UI tại {@code /api/docs}. */
@Configuration(proxyBeanMethods = false)
public class OpenApiConfig {

  private static final String BEARER = "bearerAuth";

  @Bean
  OpenAPI gfMasterOpenApi() {
    return new OpenAPI()
        .info(new Info().title("GF Master API").version("v1"))
        .components(
            new Components()
                .addSecuritySchemes(
                    BEARER,
                    new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")))
        .addSecurityItem(new SecurityRequirement().addList(BEARER));
  }
}
