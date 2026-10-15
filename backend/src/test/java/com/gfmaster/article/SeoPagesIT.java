package com.gfmaster.article;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gfmaster.support.ApiTestSupport;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import tools.jackson.databind.JsonNode;

/** SEO: trang riêng quán / chỗ chơi theo slug, sitemap, bài viết Cẩm nang (nháp / xuất bản). */
class SeoPagesIT extends ApiTestSupport {

  private JsonNode place(UUID admin, String name) throws Exception {
    return body(postAs(admin, "/api/v1/admin/catalog", """
        {"type": "cafe", "district": "CAU_GIAY", "name": "%s", "priceRange": "medium",
         "rating": 4, "openTime": "07:00", "closeTime": "22:00"}
        """.formatted(name)).andExpect(status().isCreated()));
  }

  @Test
  void placesAndSpotsGetStableReadableSlugs() throws Exception {
    UUID admin = newUser();
    String suffix = UUID.randomUUID().toString().substring(0, 6);
    JsonNode a = place(admin, "Cafe Cuối Ngõ " + suffix);
    JsonNode b = place(admin, "Cafe Cuối Ngõ " + suffix);
    String slug = a.get("slug").asString();
    assertThat(slug).isEqualTo("cafe-cuoi-ngo-" + suffix);
    assertThat(b.get("slug").asString()).isEqualTo(slug + "-2");

    // Khách xem được trang riêng
    mvc.perform(get("/api/v1/catalog/by-slug/" + slug)).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(a.get("id").asString()));
    mvc.perform(get("/api/v1/catalog/by-slug/khong-co-quan-nay")).andExpect(status().isNotFound());

    // Đổi tên: đường dẫn giữ nguyên (link cũ không chết)
    mvc.perform(
            put("/api/v1/admin/catalog/" + a.get("id").asString())
                .header(HttpHeaders.AUTHORIZATION, bearer(admin))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"type": "cafe", "district": "CAU_GIAY", "name": "Tên mới", "priceRange": "medium",
                     "rating": 4, "openTime": "07:00", "closeTime": "22:00", "version": 0}
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.slug").value(slug));

    String spot = body(postAs(admin, "/api/v1/admin/spots", """
        {"category": "museum", "district": "BA_DINH", "name": "Bảo tàng Đồng Xuân %s", "priceFrom": 0, "indoor": true}
        """.formatted(suffix)).andExpect(status().isCreated())).get("slug").asString();
    assertThat(spot).isEqualTo("bao-tang-dong-xuan-" + suffix);
    mvc.perform(get("/api/v1/spots/by-slug/" + spot)).andExpect(status().isOk());

    String sitemap = body(mvc.perform(get("/api/v1/public/sitemap")).andExpect(status().isOk())).toString();
    assertThat(sitemap).contains("/quan/" + slug).contains("/cho-choi/" + spot);
  }

  @Test
  void articlesDraftThenPublish() throws Exception {
    UUID admin = newUser();
    String suffix = UUID.randomUUID().toString().substring(0, 6);
    JsonNode draft = body(postAs(admin, "/api/v1/admin/articles", """
        {"title": "Đi đâu hẹn hò ở Hà Nội %s", "excerpt": "20 địa điểm", "body": "## Mở đầu\\n[[quan:cafe-cuoi-ngo]]", "status": "draft"}
        """.formatted(suffix)).andExpect(status().isCreated()));
    String id = draft.get("id").asString();
    String slug = draft.get("slug").asString();
    assertThat(slug).isEqualTo("di-dau-hen-ho-o-ha-noi-" + suffix);
    assertThat(draft.get("publishedAt").isNull()).isTrue();

    // Nháp: khách không thấy
    mvc.perform(get("/api/v1/articles/" + slug)).andExpect(status().isNotFound());

    // Xuất bản
    mvc.perform(
            put("/api/v1/admin/articles/" + id)
                .header(HttpHeaders.AUTHORIZATION, bearer(admin))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\": \"Đi đâu hẹn hò ở Hà Nội %s\", \"slug\": \"%s\", \"body\": \"Nội dung\", \"status\": \"published\"}".formatted(suffix, slug)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.publishedAt").isNotEmpty());
    mvc.perform(get("/api/v1/articles/" + slug)).andExpect(status().isOk()).andExpect(jsonPath("$.body").value("Nội dung"));
    assertThat(body(mvc.perform(get("/api/v1/articles?size=50"))).toString()).contains(slug);
    assertThat(body(mvc.perform(get("/api/v1/public/sitemap"))).toString()).contains("/cam-nang/" + slug);

    // Trùng đường dẫn: 409; guest không soạn được
    postAs(admin, "/api/v1/admin/articles", "{\"title\": \"Khác\", \"slug\": \"%s\"}".formatted(slug)).andExpect(status().isConflict());
    postAs(newGuestOf(admin), "/api/v1/admin/articles", "{\"title\": \"Không được\"}").andExpect(status().isForbidden());

    deleteAs(admin, "/api/v1/admin/articles/" + id).andExpect(status().isNoContent());
    mvc.perform(get("/api/v1/articles/" + slug)).andExpect(status().isNotFound());
  }
}
