package com.gfmaster.placelink;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gfmaster.support.ApiTestSupport;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PlaceLinkControllerIT extends ApiTestSupport {

  @Test
  void createReturnsPlaceTypeFromPlace() throws Exception {
    UUID user = newUser();
    String gf = createGirlfriend(user, "Mai").get("id").asString();
    String place = createPlace(user, "restaurant", "Pizza").get("id").asString();

    String req =
        """
        {"girlfriendId": "%s", "placeId": "%s", "placeType": "cafe", "herRating": 5,
         "lastVisitedAt": "2025-11-20", "memory": "Burrata"}
        """
            .formatted(gf, place);
    postAs(user, "/api/v1/place-links", req)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.placeType").value("restaurant"))
        .andExpect(jsonPath("$.girlfriendId").value(gf))
        .andExpect(jsonPath("$.lastVisitedAt").value("2025-11-20"));
  }

  @Test
  void duplicatePairReturns409() throws Exception {
    UUID user = newUser();
    String gf = createGirlfriend(user, "Mai").get("id").asString();
    String place = createPlace(user, "cafe", "A").get("id").asString();
    createLink(user, gf, place, 5);

    postAs(user, "/api/v1/place-links",
            "{\"girlfriendId\": \"%s\", \"placeId\": \"%s\", \"herRating\": 3}".formatted(gf, place))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("LINK_ALREADY_EXISTS"));
  }

  @Test
  void cannotLinkSomeoneElsesPlace() throws Exception {
    UUID me = newUser();
    UUID other = newUser();
    String myGf = createGirlfriend(me, "Mai").get("id").asString();
    String theirPlace = createPlace(other, "cafe", "Của người khác").get("id").asString();

    postAs(me, "/api/v1/place-links",
            "{\"girlfriendId\": \"%s\", \"placeId\": \"%s\", \"herRating\": 3}".formatted(myGf, theirPlace))
        .andExpect(status().isNotFound());
  }

  @Test
  void linkedPlacesAreJoinedSortedAndFilterable() throws Exception {
    UUID user = newUser();
    String gf = createGirlfriend(user, "Mai").get("id").asString();
    createLink(user, gf, createPlace(user, "cafe", "Cafe 3 sao").get("id").asString(), 3);
    createLink(user, gf, createPlace(user, "cafe", "Cafe 5 sao").get("id").asString(), 5);
    createLink(user, gf, createPlace(user, "bar", "Bar 4 sao").get("id").asString(), 4);

    getAs(user, "/api/v1/girlfriends/" + gf + "/links")
        .andExpect(jsonPath("$", hasSize(3)))
        .andExpect(jsonPath("$[0].place.name").value("Cafe 5 sao"))
        .andExpect(jsonPath("$[1].place.name").value("Bar 4 sao"))
        .andExpect(jsonPath("$[0].link.herRating").value(5));

    getAs(user, "/api/v1/girlfriends/" + gf + "/links?type=cafe")
        .andExpect(jsonPath("$", hasSize(2)));

    getAs(newUser(), "/api/v1/girlfriends/" + gf + "/links").andExpect(status().isNotFound());
  }

  @Test
  void patchUpdatesRatingAndIgnoresPairChange() throws Exception {
    UUID user = newUser();
    String gf = createGirlfriend(user, "Mai").get("id").asString();
    String place = createPlace(user, "cafe", "A").get("id").asString();
    String link = createLink(user, gf, place, 3).get("id").asString();

    patchAs(user, "/api/v1/place-links/" + link,
            "{\"herRating\": 5, \"lastVisitedAt\": null, \"placeId\": \"%s\", \"version\": 0}"
                .formatted(UUID.randomUUID()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.herRating").value(5))
        .andExpect(jsonPath("$.lastVisitedAt").isEmpty())
        .andExpect(jsonPath("$.placeId").value(place))
        .andExpect(jsonPath("$.memory").value("Vui"));
  }

  @Test
  void statsCountsPerTypeAndGirlfriends() throws Exception {
    UUID user = newUser();
    createPlace(user, "cafe", "A");
    createPlace(user, "cafe", "B");
    createPlace(user, "restaurant", "C");
    createGirlfriend(user, "Mai");

    getAs(user, "/api/v1/stats")
        .andExpect(jsonPath("$.cafes").value(2))
        .andExpect(jsonPath("$.bars").value(0))
        .andExpect(jsonPath("$.restaurants").value(1))
        .andExpect(jsonPath("$.girlfriends").value(1));
  }
}
