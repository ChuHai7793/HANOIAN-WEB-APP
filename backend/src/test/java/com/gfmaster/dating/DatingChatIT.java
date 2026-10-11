package com.gfmaster.dating;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gfmaster.support.ApiTestSupport;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.JsonNode;

/** Nhắn tin giữa hai người đã match: gửi, đọc, đã xem, tin cuối + chưa đọc, quyền, admin xem được. */
class DatingChatIT extends ApiTestSupport {

  @Autowired JdbcTemplate jdbc;
  @Autowired DatingRepository dating;

  @BeforeEach
  void onlyThisTestsProfilesAreVisible() {
    jdbc.update("update user_profiles set dating_enabled = false");
  }

  @Test
  void matchedUsersChat() throws Exception {
    UUID a = enabled();
    UUID b = enabled();
    String matchId = matchUp(a, b);
    String messages = "/api/v1/dating/matches/" + matchId + "/messages";

    // Match mới: chưa có tin
    getAs(a, "/api/v1/dating/matches")
        .andExpect(jsonPath("$[0].lastMessage").doesNotExist())
        .andExpect(jsonPath("$[0].unread").value(0));

    JsonNode first = body(send(a, messages, "  Chào bạn!  ").andExpect(status().isCreated()));
    assertThat(first.get("body").asString()).isEqualTo("Chào bạn!");
    assertThat(first.get("mine").asBoolean()).isTrue();
    send(a, messages, "Đi cafe không?").andExpect(status().isCreated());

    // B thấy 2 tin chưa đọc, tin cuối của A
    getAs(b, "/api/v1/dating/matches")
        .andExpect(jsonPath("$[0].unread").value(2))
        .andExpect(jsonPath("$[0].lastMessage.body").value("Đi cafe không?"))
        .andExpect(jsonPath("$[0].lastMessage.mine").value(false));
    getAs(b, messages)
        .andExpect(jsonPath("$", hasSize(2)))
        .andExpect(jsonPath("$[0].body").value("Chào bạn!"))
        .andExpect(jsonPath("$[0].mine").value(false));

    // Đã xem
    postAs(b, "/api/v1/dating/matches/" + matchId + "/read", "{}").andExpect(status().isNoContent());
    getAs(b, "/api/v1/dating/matches").andExpect(jsonPath("$[0].unread").value(0));
    getAs(a, messages).andExpect(jsonPath("$[1].readAt").isNotEmpty());

    // Hỏi định kỳ: chỉ tin mới hơn
    JsonNode reply = body(send(b, messages, "Ok 8h nhé").andExpect(status().isCreated()));
    String after = first.get("createdAt").asString();
    JsonNode newer = body(getAs(a, messages + "?after=" + after));
    assertThat(newer).hasSize(2);
    assertThat(newer.get(1).get("id").asString()).isEqualTo(reply.get("id").asString());
    getAs(a, messages + "?after=" + reply.get("createdAt").asString()).andExpect(jsonPath("$", hasSize(0)));
    // Cuộn lên: tin cũ hơn
    getAs(a, messages + "?before=" + reply.get("createdAt").asString()).andExpect(jsonPath("$", hasSize(2)));
  }

  @Test
  void onlyParticipantsAndValidBodies() throws Exception {
    UUID a = enabled();
    UUID b = enabled();
    UUID stranger = enabled();
    String matchId = matchUp(a, b);
    String messages = "/api/v1/dating/matches/" + matchId + "/messages";

    send(stranger, messages, "xin chào").andExpect(status().isNotFound());
    getAs(stranger, messages).andExpect(status().isNotFound());
    postAs(stranger, "/api/v1/dating/matches/" + matchId + "/read", "{}").andExpect(status().isNotFound());
    send(a, "/api/v1/dating/matches/" + UUID.randomUUID() + "/messages", "xin chào").andExpect(status().isNotFound());

    send(a, messages, "   ").andExpect(status().isBadRequest());
    send(a, messages, "x".repeat(2001)).andExpect(status().isBadRequest());
  }

  @Test
  void unmatchDeletesConversationAndBannedCannotSend() throws Exception {
    UUID admin = newUser();
    UUID guest = newGuestOf(admin);
    UUID a = enabled();
    UUID b = enabled();
    String matchId = matchUp(a, b);
    String messages = "/api/v1/dating/matches/" + matchId + "/messages";
    send(a, messages, "Chào").andExpect(status().isCreated());

    // Admin đọc được cuộc trò chuyện, mở từ danh sách match của từng người
    JsonNode activity = body(getAs(admin, "/api/v1/admin/dating/users/" + a));
    assertThat(activity.get("matches").get(0).get("matchId").asString()).isEqualTo(matchId);
    getAs(admin, "/api/v1/admin/dating/matches/" + matchId + "/messages")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].body").value("Chào"));
    getAs(guest, "/api/v1/admin/dating/matches/" + matchId + "/messages").andExpect(status().isForbidden());

    // Bị khoá: vẫn đọc được nhưng không gửi được
    mvc.perform(
            put("/api/v1/admin/dating/users/" + b + "/ban")
                .header(HttpHeaders.AUTHORIZATION, bearer(admin))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"banned\": true}"))
        .andExpect(status().isNoContent());
    send(b, messages, "Hi").andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("DATING_BANNED"));

    // Bỏ match: tin nhắn bị xoá theo
    deleteAs(a, "/api/v1/dating/matches/" + matchId).andExpect(status().isNoContent());
    getAs(a, messages).andExpect(status().isNotFound());
    assertThat(jdbc.queryForObject("select count(*) from messages where match_id = ?::uuid", Long.class, matchId))
        .isZero();
  }

  /** Java so UUID theo số có dấu, Postgres theo byte không dấu: cặp này từng làm CHECK (user_a < user_b) lỗi. */
  @Test
  void matchPairOrderFollowsPostgres() {
    UUID low = UUID.fromString("7fffffff-0000-4000-8000-" + "%012x".formatted(System.nanoTime() & 0xffffffffffffL));
    UUID high = UUID.fromString("80000000-0000-4000-8000-" + "%012x".formatted(System.nanoTime() & 0xffffffffffffL));
    for (UUID id : new UUID[] {low, high}) {
      jdbc.update(
          "insert into users (id, email, password_hash, display_name, created_at, updated_at) values (?, ?, 'x', 'T', now(), now())",
          id, id + "@test.local");
    }
    UUID matchId = dating.upsertMatch(high, low).id();
    assertThat(dating.participants(matchId)).hasValueSatisfying(pair -> assertThat(pair).containsExactly(low, high));
  }

  // ---- Helpers ----

  private ResultActions send(UUID from, String path, String text) throws Exception {
    return postAs(from, path, "{\"body\": \"%s\"}".formatted(text));
  }

  private String matchUp(UUID a, UUID b) throws Exception {
    postAs(a, "/api/v1/dating/swipes", "{\"targetId\": \"%s\", \"liked\": true}".formatted(b));
    return body(postAs(b, "/api/v1/dating/swipes", "{\"targetId\": \"%s\", \"liked\": true}".formatted(a))
            .andExpect(jsonPath("$.matched").value(true)))
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
