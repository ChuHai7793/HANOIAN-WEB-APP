package com.gfmaster.review;

import com.gfmaster.common.error.ApiException;
import com.gfmaster.common.error.ErrorCode;
import com.gfmaster.review.ReviewDtos.HelpfulResult;
import com.gfmaster.review.ReviewDtos.ReviewPage;
import com.gfmaster.review.ReviewDtos.ReviewRequest;
import com.gfmaster.review.ReviewDtos.ReviewSort;
import com.gfmaster.review.ReviewDtos.ReviewSummary;
import com.gfmaster.review.ReviewDtos.ReviewView;
import com.gfmaster.review.ReviewDtos.TargetType;
import com.gfmaster.review.ReviewRepository.ReviewOwner;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Đánh giá công khai cho quán và chỗ chơi: mỗi người một đánh giá cho mỗi địa điểm, sửa / xoá được; điểm
 * trung bình lưu sẵn trên địa điểm (cập nhật mỗi lần ghi). Người khác bấm "Hữu ích" (không tự bấm cho mình).
 */
@Service
public class ReviewService {

  static final int MAX_PAGE_SIZE = 50;

  private final ReviewRepository reviews;

  public ReviewService(ReviewRepository reviews) {
    this.reviews = reviews;
  }

  @Transactional(readOnly = true)
  public ReviewPage list(TargetType type, UUID target, UUID me, ReviewSort sort, int page, int size) {
    requireTarget(type, target);
    int p = Math.max(0, page);
    int s = Math.min(MAX_PAGE_SIZE, Math.max(1, size));
    var histogram = reviews.histogram(type, target);
    int count = histogram.stream().mapToInt(Integer::intValue).sum();
    var summary = new ReviewSummary(count == 0 ? null : reviews.storedAverage(type, target), count, histogram);
    return new ReviewPage(
        summary,
        reviews.findMine(type, target, me).orElse(null),
        reviews.page(type, target, me, sort, p, s),
        reviews.countOthers(type, target, me),
        p,
        s);
  }

  @Transactional
  public ReviewView save(TargetType type, UUID target, UUID me, ReviewRequest req) {
    requireTarget(type, target);
    String body = req.body().strip();
    if (body.length() < 10) throw new ApiException(ErrorCode.VALIDATION_FAILED, "Nhận xét tối thiểu 10 ký tự.");
    reviews.upsert(type, target, me, req.rating(), body, req.companion());
    reviews.refreshAggregate(type, target);
    return reviews.findMine(type, target, me).orElseThrow();
  }

  @Transactional
  public void delete(TargetType type, UUID target, UUID me) {
    if (!reviews.deleteMine(type, target, me)) throw ApiException.notFound();
    reviews.refreshAggregate(type, target);
  }

  @Transactional
  public HelpfulResult markHelpful(UUID reviewId, UUID me) {
    ReviewOwner owner = reviews.owner(reviewId).orElseThrow(ApiException::notFound);
    if (owner.userId().equals(me)) {
      throw new ApiException(ErrorCode.FORBIDDEN, "Không tự bấm Hữu ích cho đánh giá của mình.");
    }
    return new HelpfulResult(reviews.addVote(reviewId, me).orElse(owner.helpfulCount()), true);
  }

  @Transactional
  public HelpfulResult unmarkHelpful(UUID reviewId, UUID me) {
    ReviewOwner owner = reviews.owner(reviewId).orElseThrow(ApiException::notFound);
    return new HelpfulResult(reviews.removeVote(reviewId, me).orElse(owner.helpfulCount()), false);
  }

  private void requireTarget(TargetType type, UUID target) {
    if (!reviews.targetExists(type, target)) throw ApiException.notFound();
  }
}
