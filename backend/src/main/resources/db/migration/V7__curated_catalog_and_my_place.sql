-- V7: "Khám phá quán" do admin tự nhập (bỏ nhập tự động từ OpenStreetMap), "My place" của riêng từng người.
--
-- Khám phá quán (place_catalog): admin thêm/sửa/xoá, đủ thông tin như một quán (điểm, giá, giờ, ảnh...)
-- cộng thêm khu vực (quận) bắt buộc. Dữ liệu OSM cũ bị xoá.
-- My place (places): người dùng bấm "Add vào My place" thì quán được sao chép sang places của chính họ
-- (places.catalog_id trỏ về danh mục). Admin sửa quán trong danh mục thì các bản sao được cập nhật theo;
-- admin xoá quán thì bản sao vẫn giữ (catalog_id thành NULL).

DROP TABLE catalog_import_runs;

ALTER TABLE places DROP CONSTRAINT fk_places_catalog;
UPDATE places SET catalog_id = NULL;
DROP TABLE place_catalog;

CREATE TABLE place_catalog (
  id              UUID          NOT NULL PRIMARY KEY,
  type            VARCHAR(20)   NOT NULL,
  district        VARCHAR(30)   NOT NULL,          -- mã quận nội thành Hà Nội (CatalogDistrict)
  name            VARCHAR(120)  NOT NULL,
  address         VARCHAR(255)  NOT NULL DEFAULT '',
  price_range     VARCHAR(20)   NOT NULL,
  rating          SMALLINT      NOT NULL,
  open_time       TIME          NOT NULL,
  close_time      TIME          NOT NULL,
  image_url       VARCHAR(1024) NOT NULL DEFAULT '',
  note            TEXT          NOT NULL DEFAULT '',
  google_maps_url VARCHAR(2048) NOT NULL DEFAULT '',
  lat             NUMERIC(9,6)  NULL,
  lng             NUMERIC(9,6)  NULL,
  has_wifi        BOOLEAN       NULL,
  has_parking     BOOLEAN       NULL,
  cuisine         VARCHAR(50)   NULL,
  created_at      TIMESTAMP(6)  NOT NULL,
  updated_at      TIMESTAMP(6)  NOT NULL,
  version         BIGINT        NOT NULL DEFAULT 0,
  CONSTRAINT ck_catalog_type   CHECK (type IN ('cafe','restaurant','bar')),
  CONSTRAINT ck_catalog_price  CHECK (price_range IN ('cheap','medium','high','luxury')),
  CONSTRAINT ck_catalog_rating CHECK (rating BETWEEN 1 AND 5)
);
CREATE INDEX ix_catalog_type_district ON place_catalog (type, district);

ALTER TABLE places
  ADD CONSTRAINT fk_places_catalog FOREIGN KEY (catalog_id) REFERENCES place_catalog(id) ON DELETE SET NULL;
-- Mỗi người chỉ lưu một quán của danh mục một lần
CREATE UNIQUE INDEX uk_places_user_catalog ON places (user_id, catalog_id) WHERE catalog_id IS NOT NULL;
