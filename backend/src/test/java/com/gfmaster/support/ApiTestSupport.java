package com.gfmaster.support;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gfmaster.common.security.CurrentUserArgumentResolver;
import com.gfmaster.user.User;
import com.gfmaster.user.UserRepository;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Helper cho test API: tạo user riêng cho từng test, gọi API dưới danh nghĩa user đó. */
@IntegrationTest
public abstract class ApiTestSupport {

  @Autowired protected MockMvc mvc;
  @Autowired protected JsonMapper json;
  @Autowired protected UserRepository users;

  protected UUID newUser() {
    User u = new User();
    u.setEmail("u-" + UUID.randomUUID() + "@test.local");
    u.setPasswordHash("x");
    u.setDisplayName("Tester");
    return users.saveAndFlush(u).getId();
  }

  protected ResultActions getAs(UUID user, String path) throws Exception {
    return mvc.perform(get(path).header(CurrentUserArgumentResolver.DEBUG_HEADER, user));
  }

  protected ResultActions postAs(UUID user, String path, String body) throws Exception {
    return mvc.perform(
        post(path)
            .header(CurrentUserArgumentResolver.DEBUG_HEADER, user)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
  }

  protected ResultActions patchAs(UUID user, String path, String body) throws Exception {
    return mvc.perform(
        patch(path)
            .header(CurrentUserArgumentResolver.DEBUG_HEADER, user)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
  }

  protected ResultActions deleteAs(UUID user, String path) throws Exception {
    return mvc.perform(delete(path).header(CurrentUserArgumentResolver.DEBUG_HEADER, user));
  }

  protected JsonNode body(ResultActions result) throws Exception {
    return json.readTree(result.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
  }

  // ---- Fixture ----

  protected JsonNode createPlace(UUID user, String type, String name) throws Exception {
    String extra =
        type.equals("restaurant")
            ? "\"cuisine\": \"Món Việt\""
            : "\"hasWifi\": true, \"hasParking\": false";
    String req =
        """
        {"type": "%s", "name": "%s", "address": "1 Lê Lợi", "priceRange": "medium", "rating": 4,
         "openTime": "08:00", "closeTime": "22:00", "imageUrl": "https://img.test/a.jpg",
         "note": "", "googleMapsUrl": "", "lat": 10.7743, "lng": 106.7043, %s}
        """
            .formatted(type, name, extra);
    return body(postAs(user, "/api/v1/places", req).andExpect(status().isCreated()));
  }

  protected JsonNode createGirlfriend(UUID user, String name) throws Exception {
    String req =
        """
        {"name": "%s", "nickname": "Mèo", "birthday": "1999-04-12", "status": "dating",
         "hobbies": ["Cà phê sáng", "Xem phim"], "note": ""}
        """
            .formatted(name);
    return body(postAs(user, "/api/v1/girlfriends", req).andExpect(status().isCreated()));
  }

  protected JsonNode createLink(UUID user, String gfId, String placeId, int rating) throws Exception {
    String req =
        """
        {"girlfriendId": "%s", "placeId": "%s", "herRating": %d, "lastVisitedAt": "2025-12-24", "memory": "Vui"}
        """
            .formatted(gfId, placeId, rating);
    return body(postAs(user, "/api/v1/place-links", req).andExpect(status().isCreated()));
  }
}
