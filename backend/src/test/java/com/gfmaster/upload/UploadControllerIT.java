package com.gfmaster.upload;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.springframework.http.HttpHeaders;
import com.gfmaster.support.ApiTestSupport;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.ResultActions;
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
                .andExpect(jsonPath("$.status").value("READY")));

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
    mvc.perform(get(url)).andExpect(status().isNotFound());
  }

  @Test
  void uploadsDirectoryDoesNotAllowTraversal() throws Exception {
    mvc.perform(get("/uploads/../application-test.yml")).andExpect(status().is4xxClientError());
    mvc.perform(get("/uploads/%2e%2e/%2e%2e/pom.xml")).andExpect(status().is4xxClientError());
  }

  private ResultActions upload(UUID user, String name, String type, byte[] bytes) throws Exception {
    return mvc.perform(
        multipart("/api/v1/uploads/image")
            .file(new MockMultipartFile("file", name, type, bytes))
            .header(HttpHeaders.AUTHORIZATION, bearer(user)));
  }

  private static byte[] png(int w, int h) throws Exception {
    BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
    var g = img.createGraphics();
    g.setColor(Color.PINK);
    g.fillRect(0, 0, w, h);
    g.dispose();
    var out = new ByteArrayOutputStream();
    ImageIO.write(img, "png", out);
    return out.toByteArray();
  }
}
