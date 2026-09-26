package com.gfmaster.girlfriend;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gfmaster.support.ApiTestSupport;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class GirlfriendControllerIT extends ApiTestSupport {

  @Test
  void createAppliesDefaultsAndKeepsHobbyOrder() throws Exception {
    UUID user = newUser();
    postAs(user, "/api/v1/girlfriends", "{\"name\": \"Ngọc\", \"hobbies\": [\"Trà sữa\", \"Đi bộ\"]}")
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.status").value("dating"))
        .andExpect(jsonPath("$.nickname").value(""))
        .andExpect(jsonPath("$.birthday").isEmpty())
        .andExpect(jsonPath("$.hobbies", contains("Trà sữa", "Đi bộ")))
        .andExpect(jsonPath("$.placeCount").value(0));
  }

  @Test
  void listIncludesPlaceCount() throws Exception {
    UUID user = newUser();
    String mai = createGirlfriend(user, "Mai").get("id").asString();
    createGirlfriend(user, "Ngọc");
    createLink(user, mai, createPlace(user, "cafe", "A").get("id").asString(), 5);
    createLink(user, mai, createPlace(user, "bar", "B").get("id").asString(), 3);

    getAs(user, "/api/v1/girlfriends")
        .andExpect(jsonPath("$", hasSize(2)))
        .andExpect(jsonPath("$[?(@.name == 'Mai')].placeCount").value(2))
        .andExpect(jsonPath("$[?(@.name == 'Ngọc')].placeCount").value(0));
  }

  @Test
  void patchReplacesHobbiesAndClearsBirthday() throws Exception {
    UUID user = newUser();
    String id = createGirlfriend(user, "Mai").get("id").asString();

    patchAs(user, "/api/v1/girlfriends/" + id,
            "{\"hobbies\": [\"Chụp ảnh\"], \"birthday\": null, \"status\": \"married\", \"version\": 0}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.hobbies", contains("Chụp ảnh")))
        .andExpect(jsonPath("$.birthday").isEmpty())
        .andExpect(jsonPath("$.status").value("married"))
        .andExpect(jsonPath("$.nickname").value("Mèo"))
        .andExpect(jsonPath("$.version").value(1));
  }

  @Test
  void invalidStatusAndTooLongHobby() throws Exception {
    UUID user = newUser();
    postAs(user, "/api/v1/girlfriends", "{\"name\": \"A\", \"status\": \"single\"}")
        .andExpect(status().isBadRequest());
    postAs(user, "/api/v1/girlfriends", "{\"name\": \"A\", \"hobbies\": [\"" + "x".repeat(51) + "\"]}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
  }

  @Test
  void deleteCascadesLinksAndIsScopedToOwner() throws Exception {
    UUID owner = newUser();
    UUID stranger = newUser();
    String gfId = createGirlfriend(owner, "Mai").get("id").asString();
    String placeId = createPlace(owner, "cafe", "A").get("id").asString();
    createLink(owner, gfId, placeId, 4);

    deleteAs(stranger, "/api/v1/girlfriends/" + gfId).andExpect(status().isNotFound());
    deleteAs(owner, "/api/v1/girlfriends/" + gfId).andExpect(status().isNoContent());

    getAs(owner, "/api/v1/place-links").andExpect(jsonPath("$", hasSize(0)));
    getAs(owner, "/api/v1/places/" + placeId).andExpect(status().isOk()); // quán vẫn còn
  }
}
