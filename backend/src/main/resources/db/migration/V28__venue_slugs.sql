-- V28: đường dẫn dễ đọc cho trang riêng của quán / chỗ chơi (SEO): /quan/cafe-cuoi-ngo, /cho-choi/bao-tang-...
-- Gán lúc tạo, giữ nguyên khi đổi tên (link cũ không chết). Dữ liệu sẵn có được điền khi khởi động (SlugBackfill).
ALTER TABLE place_catalog ADD COLUMN slug VARCHAR(80) NULL;
CREATE UNIQUE INDEX uk_place_catalog_slug ON place_catalog (slug);
ALTER TABLE date_spots ADD COLUMN slug VARCHAR(80) NULL;
CREATE UNIQUE INDEX uk_date_spots_slug ON date_spots (slug);
