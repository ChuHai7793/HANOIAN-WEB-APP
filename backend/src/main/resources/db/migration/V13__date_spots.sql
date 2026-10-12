-- V13: "Tìm chỗ chơi": danh mục chỗ hẹn hò không phải quán (music box, workshop, bảo tàng, dạo hồ...).
-- Admin nhập, mọi người xem. Tách khỏi place_catalog vì không có điểm/mức giá kiểu quán và không
-- "Add vào My place": giá là giá vé theo VNĐ (0 = miễn phí), giờ mở cửa có thể không cố định.

CREATE TABLE date_spots (
  id              UUID          NOT NULL PRIMARY KEY,
  category        VARCHAR(20)   NOT NULL,
  district        VARCHAR(30)   NOT NULL,          -- mã quận nội thành Hà Nội (CatalogDistrict)
  name            VARCHAR(120)  NOT NULL,
  address         VARCHAR(255)  NOT NULL DEFAULT '',
  description     TEXT          NOT NULL DEFAULT '',
  price_from      INT           NOT NULL DEFAULT 0, -- VNĐ/người, 0 = miễn phí
  price_to        INT           NULL,               -- NULL = một mức giá
  open_time       TIME          NULL,               -- NULL (cả hai) = không có giờ cố định, ví dụ hồ, phố
  close_time      TIME          NULL,               -- nhỏ hơn open_time = mở qua nửa đêm
  hours_note      VARCHAR(255)  NOT NULL DEFAULT '', -- ví dụ 'Phố đi bộ: tối thứ 6 đến chủ nhật'
  duration_min    SMALLINT      NULL,               -- thời lượng gợi ý
  indoor          BOOLEAN       NOT NULL,           -- trong nhà: đi được khi trời mưa
  needs_booking   BOOLEAN       NOT NULL DEFAULT false,
  booking_url     VARCHAR(2048) NOT NULL DEFAULT '',
  image_url       VARCHAR(1024) NOT NULL DEFAULT '',
  google_maps_url VARCHAR(2048) NOT NULL DEFAULT '',
  lat             NUMERIC(9,6)  NULL,
  lng             NUMERIC(9,6)  NULL,
  created_at      TIMESTAMP(6)  NOT NULL,
  updated_at      TIMESTAMP(6)  NOT NULL,
  version         BIGINT        NOT NULL DEFAULT 0,
  CONSTRAINT ck_spot_category CHECK (category IN ('entertainment','workshop','museum','outdoor','show','night_market','sport')),
  CONSTRAINT ck_spot_price    CHECK (price_from >= 0 AND (price_to IS NULL OR price_to >= price_from)),
  CONSTRAINT ck_spot_hours    CHECK ((open_time IS NULL) = (close_time IS NULL)),
  CONSTRAINT ck_spot_duration CHECK (duration_min IS NULL OR duration_min BETWEEN 15 AND 1440)
);
CREATE INDEX ix_spot_category_district ON date_spots (category, district);
