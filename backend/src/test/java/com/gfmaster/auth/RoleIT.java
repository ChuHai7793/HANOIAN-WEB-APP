package com.gfmaster.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gfmaster.support.ApiTestSupport;
import com.gfmaster.user.Role;
import com.gfmaster.user.User;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;

/** Phân quyền: admin được ghi; guest xem dữ liệu của admin, mọi request ghi bị 403. */
class RoleIT extends ApiTestSupport {

  @Autowired JdbcTemplate jdbc;
  @Autowired PasswordEncoder passwordEncoder;

  /** IP riêng cho test này: login/register bị giới hạn 5 lần/phút theo IP. */
  private final String ip = "10.77." + (int) (Math.random() * 250) + "." + (1 + (int) (Math.random() * 250));

  @Test
  void guestSeesAdminDataButEveryWriteIsForbidden() throws Exception {
    UUID admin = newUser();
    String placeId = createPlace(admin, "cafe", "Của admin").get("id").asString();
    String gfId = createGirlfriend(admin, "Mai").get("id").asString();
    String linkId = createLink(admin, gfId, placeId, 5).get("id").asString();
    UUID guest = newGuestOf(admin);

    // Xem được đúng dữ liệu của admin
    getAs(guest, "/api/v1/places").andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(1)));
    getAs(guest, "/api/v1/places/" + placeId).andExpect(jsonPath("$.name").value("Của admin"));
    getAs(guest, "/api/v1/girlfriends").andExpect(jsonPath("$[0].name").value("Mai"));
    getAs(guest, "/api/v1/girlfriends/" + gfId + "/links").andExpect(jsonPath("$", hasSize(1)));
    getAs(guest, "/api/v1/place-links").andExpect(jsonPath("$", hasSize(1)));
    getAs(guest, "/api/v1/stats").andExpect(jsonPath("$.cafes").value(1)).andExpect(jsonPath("$.girlfriends").value(1));

    // Mọi thao tác ghi: 403 FORBIDDEN, dữ liệu không đổi
    forbidden(postAs(guest, "/api/v1/places", "{}"));
    forbidden(patchAs(guest, "/api/v1/places/" + placeId, "{\"name\": \"Guest sửa\", \"version\": 0}"));
    forbidden(deleteAs(guest, "/api/v1/places/" + placeId));
    forbidden(postAs(guest, "/api/v1/girlfriends", "{\"name\": \"Lan\"}"));
    forbidden(patchAs(guest, "/api/v1/girlfriends/" + gfId, "{\"name\": \"X\", \"version\": 0}"));
    forbidden(deleteAs(guest, "/api/v1/girlfriends/" + gfId));
    forbidden(postAs(guest, "/api/v1/place-links", "{}"));
    forbidden(deleteAs(guest, "/api/v1/place-links/" + linkId));
    forbidden(postAs(guest, "/api/v1/import/local-storage", "{\"girlfriends\": [{\"name\": \"Lan\"}]}"));
    forbidden(
        mvc.perform(
            multipart("/api/v1/uploads/image")
                .file(new MockMultipartFile("file", "a.png", "image/png", png(50, 50)))
                .header(HttpHeaders.AUTHORIZATION, bearer(guest))));

    getAs(admin, "/api/v1/places/" + placeId)
        .andExpect(jsonPath("$.name").value("Của admin"))
        .andExpect(jsonPath("$.version").value(0));
    assertThat(jdbc.queryForObject("select count(*) from girlfriends where user_id = ?::uuid", Integer.class, admin.toString()))
        .isEqualTo(1);
  }

  @Test
  void guestCanStillUseOwnAccountEndpoints() throws Exception {
    UUID guest = newGuestOf(newUser());
    getAs(guest, "/api/v1/auth/me")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(guest.toString()))
        .andExpect(jsonPath("$.role").value("GUEST"));
    postAs(guest, "/api/v1/auth/logout-all", "").andExpect(status().isNoContent());
  }

  @Test
  void adminCanWrite() throws Exception {
    UUID admin = newUser();
    getAs(admin, "/api/v1/auth/me").andExpect(jsonPath("$.role").value("ADMIN"));
    createPlace(admin, "bar", "Admin tạo được");
  }

  @Test
  void selfRegisteredAccountIsGuestOfFirstAdmin() throws Exception {
    String firstAdmin =
        jdbc.queryForObject(
            "select id from users where role = 'ADMIN' order by created_at limit 1", String.class);
    String email = "reg-" + UUID.randomUUID() + "@test.local";

    JsonNode body =
        body(
            mvc.perform(
                    anon(post("/api/v1/auth/register"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\": \"%s\", \"password\": \"Passw0rd!\", \"displayName\": \"Mới\"}".formatted(email)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.user.role").value("GUEST")));

    UUID id = UUID.fromString(body.get("user").get("id").asString());
    assertThat(jdbc.queryForObject("select owner_id from users where id = ?::uuid", String.class, id.toString()))
        .isEqualTo(firstAdmin);
    String token = "Bearer " + body.get("accessToken").asString();
    mvc.perform(post("/api/v1/places").header(HttpHeaders.AUTHORIZATION, token).contentType(MediaType.APPLICATION_JSON).content("{}"))
        .andExpect(status().isForbidden());
  }

  @Test
  void loginWorksWithUsernameOrEmail() throws Exception {
    String username = "u" + UUID.randomUUID().toString().substring(0, 8);
    User u = new User();
    u.setEmail(username + "@test.local");
    u.setUsername(username);
    u.setPasswordHash(passwordEncoder.encode("secret@12345"));
    u.setDisplayName("Có tên");
    u.setRole(Role.ADMIN);
    users.saveAndFlush(u);

    login("{\"login\": \"%s\", \"password\": \"secret@12345\"}".formatted(username.toUpperCase()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.user.username").value(username))
        .andExpect(jsonPath("$.user.role").value("ADMIN"));
    // Field cũ "email" vẫn nhận (client cũ)
    login("{\"email\": \"%s@test.local\", \"password\": \"secret@12345\"}".formatted(username)).andExpect(status().isOk());
    login("{\"login\": \"%s\", \"password\": \"sai\"}".formatted(username))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
  }

  private ResultActions login(String json) throws Exception {
    return mvc.perform(anon(post("/api/v1/auth/login")).contentType(MediaType.APPLICATION_JSON).content(json));
  }

  private MockHttpServletRequestBuilder anon(MockHttpServletRequestBuilder req) {
    return req.with(
        r -> {
          r.setRemoteAddr(ip);
          return r;
        });
  }

  private static void forbidden(ResultActions result) throws Exception {
    result.andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }
}
