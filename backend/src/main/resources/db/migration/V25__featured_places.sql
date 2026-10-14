-- V25: "Điểm hẹn nổi bật" ở đầu trang Khám phá quán: tối đa 3 quán do admin chọn, kèm dòng nhỏ
-- (vd. "Một chút bình yên") và câu dẫn (vd. "Chậm lại, bên một tách cà phê."). Xoá quán thì mất vị trí.
CREATE TABLE featured_places (
  position   SMALLINT     NOT NULL PRIMARY KEY,
  catalog_id UUID         NOT NULL UNIQUE REFERENCES place_catalog(id) ON DELETE CASCADE,
  kicker     VARCHAR(60)  NOT NULL DEFAULT '',
  headline   VARCHAR(120) NOT NULL,
  CONSTRAINT ck_featured_position CHECK (position BETWEEN 1 AND 3)
);
