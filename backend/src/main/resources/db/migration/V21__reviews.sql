-- V21: đánh giá công khai cho quán (Khám phá quán) và chỗ chơi (Tìm chỗ chơi).
-- Mỗi người một đánh giá cho mỗi địa điểm (sửa / xoá được); người khác bấm "Hữu ích".
-- target_type: place = place_catalog, spot = date_spots. Không dùng FK đa hình: xoá địa điểm thì
-- xoá đánh giá của nó bằng trigger bên dưới.
CREATE TABLE reviews (
  id            UUID          NOT NULL PRIMARY KEY,
  target_type   VARCHAR(10)   NOT NULL,
  target_id     UUID          NOT NULL,
  user_id       UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating        SMALLINT      NOT NULL,
  body          VARCHAR(1000) NOT NULL,
  -- Đi cùng ai: lover | friends | solo | family; NULL = không nói
  companion     VARCHAR(10)   NULL,
  helpful_count INTEGER       NOT NULL DEFAULT 0,
  created_at    TIMESTAMP(6)  NOT NULL,
  updated_at    TIMESTAMP(6)  NOT NULL,
  CONSTRAINT ck_reviews_target CHECK (target_type IN ('place', 'spot')),
  CONSTRAINT ck_reviews_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT ck_reviews_companion CHECK (companion IS NULL OR companion IN ('lover', 'friends', 'solo', 'family')),
  CONSTRAINT uk_reviews_target_user UNIQUE (target_type, target_id, user_id)
);
CREATE INDEX ix_reviews_target_helpful ON reviews (target_type, target_id, helpful_count DESC, created_at DESC);
CREATE INDEX ix_reviews_user ON reviews (user_id);

-- "Hữu ích": mỗi người bấm một lần cho mỗi đánh giá
CREATE TABLE review_votes (
  review_id  UUID         NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP(6) NOT NULL,
  PRIMARY KEY (review_id, user_id)
);
CREATE INDEX ix_review_votes_user ON review_votes (user_id);

-- Điểm trung bình lưu sẵn trên địa điểm: danh sách quán đọc thẳng, không phải tính lại mỗi lần
ALTER TABLE place_catalog
  ADD COLUMN rating_avg   NUMERIC(2, 1) NULL,
  ADD COLUMN rating_count INTEGER       NOT NULL DEFAULT 0;
ALTER TABLE date_spots
  ADD COLUMN rating_avg   NUMERIC(2, 1) NULL,
  ADD COLUMN rating_count INTEGER       NOT NULL DEFAULT 0;

CREATE FUNCTION delete_target_reviews() RETURNS trigger AS $$
BEGIN
  DELETE FROM reviews WHERE target_type = TG_ARGV[0] AND target_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_place_catalog_reviews AFTER DELETE ON place_catalog
  FOR EACH ROW EXECUTE FUNCTION delete_target_reviews('place');
CREATE TRIGGER trg_date_spots_reviews AFTER DELETE ON date_spots
  FOR EACH ROW EXECUTE FUNCTION delete_target_reviews('spot');
