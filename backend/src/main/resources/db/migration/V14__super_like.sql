-- V14: "Siêu thích" (giới hạn lượt mỗi ngày). Người được siêu thích thấy người đó đầu tiên trên thẻ.
-- Đếm lượt trong ngày theo người quẹt và thời gian nên thêm index (swiper_id, created_at).

ALTER TABLE swipes
  ADD COLUMN super_like BOOLEAN NOT NULL DEFAULT false,
  ADD CONSTRAINT ck_swipe_super CHECK (NOT super_like OR liked);

CREATE INDEX ix_swipe_swiper_time ON swipes (swiper_id, created_at);
