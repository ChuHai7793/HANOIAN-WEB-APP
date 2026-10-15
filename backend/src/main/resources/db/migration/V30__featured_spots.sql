-- V30: "Chỗ chơi nổi bật" ở đầu trang Tìm chỗ chơi, giống featured_places: tối đa 6 chỗ admin chọn, kèm dòng nhỏ
-- và câu dẫn. Xoá chỗ chơi thì mất vị trí. Ảnh nền banner Tìm chỗ chơi nằm trong app_settings (khoá spots.banner).
CREATE TABLE featured_spots (
  position SMALLINT     NOT NULL PRIMARY KEY,
  spot_id  UUID         NOT NULL UNIQUE REFERENCES date_spots(id) ON DELETE CASCADE,
  kicker   VARCHAR(60)  NOT NULL DEFAULT '',
  headline VARCHAR(120) NOT NULL,
  CONSTRAINT ck_featured_spot_position CHECK (position BETWEEN 1 AND 6)
);
