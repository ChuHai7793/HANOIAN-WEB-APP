-- V6: "Khám phá quán": danh mục quán lấy từ OpenStreetMap (Overpass API), dùng chung cho mọi người.
-- Tách khỏi places ("sổ tay"): quán trong danh mục chưa ai đánh giá, không có mức giá, ảnh, ghi chú.
-- Dữ liệu OSM theo giấy phép ODbL: hiển thị phải ghi "© OpenStreetMap contributors".

CREATE TABLE place_catalog (
  id            UUID          NOT NULL PRIMARY KEY,
  source        VARCHAR(20)   NOT NULL,          -- 'osm'
  external_id   VARCHAR(40)   NOT NULL,          -- mã trong nguồn, ví dụ 'node/123456'
  type          VARCHAR(20)   NOT NULL,
  name          VARCHAR(255)  NOT NULL,
  address       VARCHAR(500)  NULL,              -- OSM thường thiếu, ghép từ số nhà + đường nếu có
  district      VARCHAR(30)   NULL,              -- mã quận lúc nhập (gần đúng, theo khung toạ độ)
  lat           NUMERIC(9,6)  NOT NULL,
  lng           NUMERIC(9,6)  NOT NULL,
  opening_hours VARCHAR(255)  NULL,              -- chuỗi gốc của OSM, ví dụ 'Mo-Su 07:00-22:00'
  cuisine       VARCHAR(100)  NULL,
  phone         VARCHAR(50)   NULL,
  website       VARCHAR(500)  NULL,
  has_wifi      BOOLEAN       NULL,
  fetched_at    TIMESTAMP(6)  NOT NULL,          -- lần cuối thấy quán này khi nhập
  created_at    TIMESTAMP(6)  NOT NULL,
  updated_at    TIMESTAMP(6)  NOT NULL,
  CONSTRAINT uk_catalog_source UNIQUE (source, external_id),
  CONSTRAINT ck_catalog_type CHECK (type IN ('cafe','restaurant','bar'))
);
CREATE INDEX ix_catalog_type_district ON place_catalog (type, district);

-- Mỗi lần admin bấm "Bắt đầu nhập". Chạy nền; giao diện hỏi lại để hiện tiến trình.
CREATE TABLE catalog_import_runs (
  id           UUID         NOT NULL PRIMARY KEY,
  requested_by UUID         NULL,
  status       VARCHAR(20)  NOT NULL,            -- RUNNING | DONE | FAILED
  districts    VARCHAR(500) NOT NULL,            -- mã quận, ngăn cách bằng dấu phẩy
  types        VARCHAR(100) NOT NULL,
  total_cells  INT          NOT NULL,            -- số ô (quận × loại) cần lấy
  done_cells   INT          NOT NULL DEFAULT 0,
  added        INT          NOT NULL DEFAULT 0,
  updated      INT          NOT NULL DEFAULT 0,
  errors       TEXT         NOT NULL DEFAULT '', -- mỗi dòng một ô bị lỗi
  started_at   TIMESTAMP(6) NOT NULL,
  finished_at  TIMESTAMP(6) NULL,
  CONSTRAINT fk_catalog_run_user FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT ck_catalog_run_status CHECK (status IN ('RUNNING','DONE','FAILED'))
);
-- Chỉ một lượt nhập chạy cùng lúc, kể cả khi hai request đến đồng thời
CREATE UNIQUE INDEX uk_catalog_run_running ON catalog_import_runs (status) WHERE status = 'RUNNING';

-- Quán trong sổ tay được thêm từ danh mục: để danh mục hiện nhãn "Đã có trong sổ tay"
ALTER TABLE places ADD COLUMN catalog_id UUID NULL;
ALTER TABLE places ADD CONSTRAINT fk_places_catalog FOREIGN KEY (catalog_id) REFERENCES place_catalog(id) ON DELETE SET NULL;
CREATE INDEX ix_places_catalog ON places (catalog_id);
