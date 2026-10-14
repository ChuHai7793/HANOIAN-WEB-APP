package com.gfmaster.review;

import com.gfmaster.common.security.CurrentUser;
import com.gfmaster.review.ReviewDtos.HelpfulResult;
import com.gfmaster.review.ReviewDtos.ReviewPage;
import com.gfmaster.review.ReviewDtos.ReviewRequest;
import com.gfmaster.review.ReviewDtos.ReviewSort;
import com.gfmaster.review.ReviewDtos.ReviewView;
import com.gfmaster.review.ReviewDtos.TargetType;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Đánh giá quán / chỗ chơi. {@code GET /reviews} công khai (khách xem được); viết, sửa, xoá, "Hữu ích" cần
 * đăng nhập (guest cũng được: đánh giá là của chính người viết, không đụng dữ liệu admin).
 */
@RestController
@RequestMapping("/api/v1/reviews")
public class ReviewController {

  private final ReviewService service;

  public ReviewController(ReviewService service) {
    this.service = service;
  }

  @GetMapping
  public ReviewPage list(
      @CurrentUser(required = false) UUID me,
      @RequestParam TargetType target,
      @RequestParam UUID id,
      @RequestParam(defaultValue = "helpful") ReviewSort sort,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "10") int size) {
    return service.list(target, id, me, sort, page, size);
  }

  /** Viết hoặc sửa đánh giá của mình cho địa điểm */
  @PutMapping("/mine")
  public ReviewView save(
      @CurrentUser UUID me,
      @RequestParam TargetType target,
      @RequestParam UUID id,
      @Valid @RequestBody ReviewRequest req) {
    return service.save(target, id, me, req);
  }

  @DeleteMapping("/mine")
  public ResponseEntity<Void> delete(@CurrentUser UUID me, @RequestParam TargetType target, @RequestParam UUID id) {
    service.delete(target, id, me);
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/{id}/helpful")
  public HelpfulResult helpful(@CurrentUser UUID me, @PathVariable UUID id) {
    return service.markHelpful(id, me);
  }

  @DeleteMapping("/{id}/helpful")
  public HelpfulResult unhelpful(@CurrentUser UUID me, @PathVariable UUID id) {
    return service.unmarkHelpful(id, me);
  }
}
