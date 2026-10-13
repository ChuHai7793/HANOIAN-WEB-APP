-- V17: nhiều ảnh (tối đa 6) cho quán trong Khám phá quán và cho chỗ chơi. Ảnh đầu tiên là ảnh bìa;
-- cột image_url cũ giữ làm ảnh bìa (luôn bằng ảnh số 0) cho các chỗ chỉ cần một ảnh. Ảnh đang có thành ảnh số 0.

CREATE TABLE catalog_photos (
  catalog_id UUID          NOT NULL,
  position   INT           NOT NULL,
  url        VARCHAR(1024) NOT NULL,                -- dạng lưu /uploads/<key> hoặc link http(s)
  PRIMARY KEY (catalog_id, position),
  CONSTRAINT fk_catalog_photo FOREIGN KEY (catalog_id) REFERENCES place_catalog(id) ON DELETE CASCADE,
  CONSTRAINT ck_catalog_photo_position CHECK (position BETWEEN 0 AND 5)
);

CREATE TABLE spot_photos (
  spot_id  UUID          NOT NULL,
  position INT           NOT NULL,
  url      VARCHAR(1024) NOT NULL,
  PRIMARY KEY (spot_id, position),
  CONSTRAINT fk_spot_photo FOREIGN KEY (spot_id) REFERENCES date_spots(id) ON DELETE CASCADE,
  CONSTRAINT ck_spot_photo_position CHECK (position BETWEEN 0 AND 5)
);

INSERT INTO catalog_photos (catalog_id, position, url) SELECT id, 0, image_url FROM place_catalog WHERE image_url <> '';
INSERT INTO spot_photos (spot_id, position, url) SELECT id, 0, image_url FROM date_spots WHERE image_url <> '';
