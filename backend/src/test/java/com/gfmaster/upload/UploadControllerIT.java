package com.gfmaster.upload;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gfmaster.support.ApiTestSupport;
import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

class UploadControllerIT extends ApiTestSupport {

  @Test
  void largePngIsResizedToWebpAndServed() throws Exception {
    UUID user = newUser();
    JsonNode res =
        body(
            upload(user, "big.png", "image/png", png(2400, 1200))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.width").value(1200))
                .andExpect(jsonPath("$.height").value(600))
                .andExpect(jsonPath("$.status").value("THUMB_PENDING"))
                .andExpect(jsonPath("$.thumbUrl").isEmpty()));

    String url = res.get("url").asString();
    assertThat(url).startsWith("/uploads/" + user + "/").endsWith(".webp");

    byte[] served = mvc.perform(get(url)).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
    assertThat(new String(served, 8, 4)).isEqualTo("WEBP");
  }

  @Test
  void smallImageIsNotUpscaled() throws Exception {
    upload(newUser(), "small.png", "image/png", png(300, 200))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.width").value(300));
  }

  @Test
  void rejectsNonImagesEvenWithImageContentType() throws Exception {
    upload(newUser(), "evil.png", "image/png", "<script>alert(1)</script>".getBytes())
        .andExpect(status().isUnsupportedMediaType())
        .andExpect(jsonPath("$.code").value("UNSUPPORTED_IMAGE"));
  }

  @Test
  void deleteIsOwnerOnlyAndRemovesFile() throws Exception {
    UUID owner = newUser();
    JsonNode res = body(upload(owner, "a.png", "image/png", png(100, 100)).andExpect(status().isCreated()));
    String id = res.get("id").asString();
    String url = res.get("url").asString();

    deleteAs(newUser(), "/api/v1/uploads/" + id).andExpect(status().isNotFound());
    mvc.perform(get(url)).andExpect(status().isOk());

    deleteAs(owner, "/api/v1/uploads/" + id).andExpect(status().isNoContent());
    // File được consumer xoá sau commit (event upload.deleted)
    await().atMost(Duration.ofSeconds(15))
        .untilAsserted(() -> mvc.perform(get(url)).andExpect(status().isNotFound()));
  }

  @Test
  void uploadsDirectoryDoesNotAllowTraversal() throws Exception {
    mvc.perform(get("/uploads/../application-test.yml")).andExpect(status().is4xxClientError());
    mvc.perform(get("/uploads/%2e%2e/%2e%2e/pom.xml")).andExpect(status().is4xxClientError());
  }
}
