package com.gfmaster.review;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gfmaster.support.ApiTestSupport;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.JsonNode;

/** Đánh giá công khai: mỗi người một đánh giá / địa điểm, điểm trung bình trên thẻ, "Hữu ích", khách chỉ xem. */
class ReviewsIT extends ApiTestSupport {

  private String newPlace(UUID admin) throws Exception {
    return newPlace(admin, "Quán " + UUID.randomUUID());
  }

  private String newPlace(UUID admin, String name) throws Exception {
    return body(postAs(admin, "/api/v1/admin/catalog", """
        {"type": "cafe", "district": "HOAN_KIEM", "name": "%s", "priceRange": "medium",
         "rating": 4, "openTime": "07:00", "closeTime": "22:00"}
        """.formatted(name)).andExpect(status().isCreated())).get("id").asString();
  }

  private String newSpot(UUID admin) throws Exception {
    return body(postAs(admin, "/api/v1/admin/spots", """
        {"category": "museum", "district": "BA_DINH", "name": "Chỗ %s", "priceFrom": 0, "indoor": true}
        """.formatted(UUID.randomUUID())).andExpect(status().isCreated())).get("id").asString();
  }

  private ResultActions review(UUID user, String target, String id, int rating, String body) throws Exception {
    return mvc.perform(
        put("/api/v1/reviews/mine?target=" + target + "&id=" + id)
            .header(HttpHeaders.AUTHORIZATION, bearer(user))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"rating\": %d, \"body\": \"%s\", \"companion\": \"lover\"}".formatted(rating, body)));
  }

  @Test
  void writeEditDeleteAndAverageOnCards() throws Exception {
    UUID admin = newUser();
    UUID linh = newGuestOf(admin);
    UUID nam = newGuestOf(admin);
    String name = "Quán " + UUID.randomUUID();
    String place = newPlace(admin, name);

    review(linh, "place", place, 5, "Quán yên tĩnh, nhạc nhẹ, hợp hẹn hò.").andExpect(status().isOk())
        .andExpect(jsonPath("$.mine").value(true))
        .andExpect(jsonPath("$.companion").value("lover"));
    review(nam, "place", place, 2, "Đông quá, phục vụ chậm.").andExpect(status().isOk());

    // Điểm trung bình lưu trên quán: hiện ngay ở danh sách
    getAs(admin, "/api/v1/catalog?q=" + name)
        .andExpect(jsonPath("$.items[0].ratingAvg").value(3.5))
        .andExpect(jsonPath("$.items[0].ratingCount").value(2));

    // Sửa (không tạo đánh giá thứ hai)
    review(linh, "place", place, 4, "Vẫn thích, nhưng hơi đắt một chút.").andExpect(status().isOk());
    JsonNode page = body(getAs(linh, "/api/v1/reviews?target=place&id=" + place));
    assertThat(page.get("summary").get("count").asInt()).isEqualTo(2);
    assertThat(page.get("summary").get("average").asDouble()).isEqualTo(3.0);
    assertThat(page.get("summary").get("histogram").toString()).isEqualTo("[0,1,0,1,0]");
    assertThat(page.get("mine").get("rating").asInt()).isEqualTo(4);
    // Đánh giá của mình trả riêng, danh sách chỉ có của người khác
    assertThat(page.get("items")).hasSize(1);
    assertThat(page.get("items").get(0).get("author").get("id").asString()).isEqualTo(nam.toString());

    // Xoá
    deleteAs(linh, "/api/v1/reviews/mine?target=place&id=" + place).andExpect(status().isNoContent());
    deleteAs(linh, "/api/v1/reviews/mine?target=place&id=" + place).andExpect(status().isNotFound());
    getAs(admin, "/api/v1/catalog?q=" + name).andExpect(jsonPath("$.items[0].ratingAvg").value(2.0));
  }

  @Test
  void guestsCanReadButNotWrite() throws Exception {
    UUID admin = newUser();
    UUID linh = newGuestOf(admin);
    String spot = newSpot(admin);
    review(linh, "spot", spot, 5, "Bảo tàng đẹp, nhiều góc chụp ảnh.").andExpect(status().isOk());

    // Khách chưa đăng nhập: đọc được, không có "mine"
    mvc.perform(get("/api/v1/reviews?target=spot&id=" + spot))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items", hasSize(1)))
        .andExpect(jsonPath("$.items[0].helpedByMe").value(false))
        .andExpect(jsonPath("$.mine").doesNotExist());
    mvc.perform(
            put("/api/v1/reviews/mine?target=spot&id=" + spot)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"rating\": 5, \"body\": \"Không đăng nhập mà viết\"}"))
        .andExpect(status().isUnauthorized());
    getAs(admin, "/api/v1/spots?q=Chỗ").andExpect(status().isOk());
  }

  @Test
  void validationAndUnknownTargets() throws Exception {
    UUID admin = newUser();
    String place = newPlace(admin);
    review(admin, "place", place, 6, "Sao không hợp lệ đâu nhé").andExpect(status().isBadRequest());
    review(admin, "place", place, 5, "Ngắn").andExpect(status().isBadRequest());
    review(admin, "place", UUID.randomUUID().toString(), 5, "Quán không tồn tại nè").andExpect(status().isNotFound());
    review(admin, "spot", place, 5, "Sai loại địa điểm rồi").andExpect(status().isNotFound());
  }

  @Test
  void helpfulVotes() throws Exception {
    UUID admin = newUser();
    UUID linh = newGuestOf(admin);
    UUID nam = newGuestOf(admin);
    UUID mai = newGuestOf(admin);
    String place = newPlace(admin);
    String reviewId = body(review(linh, "place", place, 5, "Đồ uống ngon, view đẹp.")).get("id").asString();
    review(nam, "place", place, 3, "Bình thường, không có gì đặc biệt.");

    // Không tự bấm cho mình; bấm 2 lần chỉ tính 1
    postAs(linh, "/api/v1/reviews/" + reviewId + "/helpful", "").andExpect(status().isForbidden());
    postAs(nam, "/api/v1/reviews/" + reviewId + "/helpful", "").andExpect(jsonPath("$.helpfulCount").value(1));
    postAs(nam, "/api/v1/reviews/" + reviewId + "/helpful", "").andExpect(jsonPath("$.helpfulCount").value(1));
    postAs(mai, "/api/v1/reviews/" + reviewId + "/helpful", "").andExpect(jsonPath("$.helpfulCount").value(2));

    // Sắp xếp "Hữu ích": đánh giá được bấm nhiều lên đầu; người đã bấm thấy helpedByMe
    getAs(mai, "/api/v1/reviews?target=place&id=" + place + "&sort=helpful")
        .andExpect(jsonPath("$.items[0].id").value(reviewId))
        .andExpect(jsonPath("$.items[0].helpedByMe").value(true))
        .andExpect(jsonPath("$.items[1].helpedByMe").value(false));
    getAs(mai, "/api/v1/reviews?target=place&id=" + place + "&sort=low").andExpect(jsonPath("$.items[0].rating").value(3));

    deleteAs(mai, "/api/v1/reviews/" + reviewId + "/helpful")
        .andExpect(jsonPath("$.helpfulCount").value(1))
        .andExpect(jsonPath("$.helpedByMe").value(false));
  }

  @Test
  void deletingThePlaceDeletesItsReviews() throws Exception {
    UUID admin = newUser();
    UUID linh = newGuestOf(admin);
    String place = newPlace(admin);
    review(linh, "place", place, 5, "Sắp bị xoá nhưng vẫn khen.").andExpect(status().isOk());
    deleteAs(admin, "/api/v1/admin/catalog/" + place).andExpect(status().isNoContent());
    getAs(linh, "/api/v1/reviews?target=place&id=" + place).andExpect(status().isNotFound());
  }
}
