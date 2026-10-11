package com.gfmaster.dating;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gfmaster.realtime.SseHub;
import com.gfmaster.support.ApiTestSupport;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MvcResult;

/** SSE: tin mới, đã xem, match mới, bỏ match được đẩy tới đúng người qua Redis pub/sub. */
class DatingRealtimeIT extends ApiTestSupport {

  @Autowired JdbcTemplate jdbc;
  @Autowired SseHub hub;

  @BeforeEach
  void onlyThisTestsProfilesAreVisible() {
    jdbc.update("update user_profiles set dating_enabled = false");
  }

  @Test
  void messagesReadAndUnmatchArePushed() throws Exception {
    UUID a = enabled();
    UUID b = enabled();
    UUID stranger = enabled();
    String matchId = matchUp(a, b);
    MvcResult aStream = connect(a);
    MvcResult bStream = connect(b);
    MvcResult strangerStream = connect(stranger);
    assertThat(text(bStream)).contains("event:ready");

    postAs(a, "/api/v1/dating/matches/" + matchId + "/messages", "{\"body\": \"hello B\"}").andExpect(status().isCreated());
    awaitContains(bStream, "event:message", "hello B", "\"mine\":false", matchId);
    // Tab khác của chính người gửi cũng nhận, với mine = true
    awaitContains(aStream, "hello B", "\"mine\":true");

    postAs(b, "/api/v1/dating/matches/" + matchId + "/read", "{}").andExpect(status().isNoContent());
    awaitContains(aStream, "event:read", matchId);

    postAs(a, "/api/v1/dating/matches/" + matchId + "/messages", "{\"body\": \"bye\"}");
    deleteAs(a, "/api/v1/dating/matches/" + matchId).andExpect(status().isNoContent());
    awaitContains(bStream, "event:unmatch", matchId);

    // Người ngoài không nhận gì của cặp này
    assertThat(text(strangerStream)).doesNotContain(matchId);
  }

  @Test
  void newMatchIsPushedToTheOtherPersonAndBlockEndsTheChat() throws Exception {
    UUID c = enabled();
    UUID d = enabled();
    MvcResult cStream = connect(c);

    postAs(c, "/api/v1/dating/swipes", "{\"targetId\": \"%s\", \"liked\": true}".formatted(d));
    String matchId = body(postAs(d, "/api/v1/dating/swipes", "{\"targetId\": \"%s\", \"liked\": true}".formatted(c)))
        .get("match").get("id").asString();
    // C thấy match với D ngay, kèm thẻ của D
    awaitContains(cStream, "event:match", matchId, d.toString());

    postAs(d, "/api/v1/dating/blocks", "{\"userId\": \"%s\"}".formatted(c)).andExpect(status().isNoContent());
    awaitContains(cStream, "event:unmatch", matchId);
  }

  @Test
  void streamNeedsLoginAndKeepsAtMostFiveTabs() throws Exception {
    mvc.perform(get("/api/v1/dating/stream").accept(MediaType.TEXT_EVENT_STREAM)).andExpect(status().isUnauthorized());

    UUID u = enabled();
    for (int i = 0; i < 7; i++) connect(u);
    assertThat(hub.connections(u)).isEqualTo(5);
  }

  // ---- Helpers ----

  private MvcResult connect(UUID user) throws Exception {
    return mvc.perform(
            get("/api/v1/dating/stream")
                .header(HttpHeaders.AUTHORIZATION, bearer(user))
                .accept(MediaType.TEXT_EVENT_STREAM))
        .andExpect(request().asyncStarted())
        .andReturn();
  }

  private static String text(MvcResult stream) throws Exception {
    return stream.getResponse().getContentAsString(StandardCharsets.UTF_8);
  }

  private static void awaitContains(MvcResult stream, String... parts) {
    await().atMost(Duration.ofSeconds(5)).untilAsserted(() -> assertThat(text(stream)).contains(parts));
  }

  private String matchUp(UUID a, UUID b) throws Exception {
    postAs(a, "/api/v1/dating/swipes", "{\"targetId\": \"%s\", \"liked\": true}".formatted(b));
    return body(postAs(b, "/api/v1/dating/swipes", "{\"targetId\": \"%s\", \"liked\": true}".formatted(a)))
        .get("match").get("id").asString();
  }

  private UUID enabled() {
    UUID id = newUser();
    jdbc.update(
        """
        insert into user_profiles (user_id, avatar_url, birthday, gender, city, bio, completed_at,
                                   created_at, updated_at, version, dating_enabled)
        values (?, '/uploads/a.webp', ?, 'female', 'Hà Nội', '', now(), now(), now(), 0, true)
        """,
        id, LocalDate.now().minusYears(25));
    return id;
  }
}
