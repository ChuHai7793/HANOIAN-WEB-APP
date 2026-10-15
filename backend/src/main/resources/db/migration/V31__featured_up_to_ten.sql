-- V31: khối nổi bật (Khám phá quán, Tìm chỗ chơi) cho tối đa 10 địa điểm, tự trượt vòng tròn trên trang.
ALTER TABLE featured_places DROP CONSTRAINT ck_featured_position;
ALTER TABLE featured_places ADD CONSTRAINT ck_featured_position CHECK (position BETWEEN 1 AND 10);
ALTER TABLE featured_spots DROP CONSTRAINT ck_featured_spot_position;
ALTER TABLE featured_spots ADD CONSTRAINT ck_featured_spot_position CHECK (position BETWEEN 1 AND 10);
