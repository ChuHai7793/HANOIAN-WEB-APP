-- V15: nhãn "kiểu hẹn" cho quán (place_catalog) và chỗ chơi (date_spots), dùng cho Autoplan của mục Plan.
--   vibes        : danh sách nhãn, cách nhau bằng dấu phẩy, theo thứ tự chill,active,romantic ('' = không nhãn nào)
--   vibes_source : nhãn từ đâu, cũng là thứ tự được ghi đè:
--                  'default' = suy ra từ loại quán / nhóm chỗ chơi (hàm bên dưới)
--                  'claude'  = Claude gán từ mô tả, được ghi đè 'default'
--                  'admin'   = admin sửa tay; không gì tự ghi đè
-- Hai hàm default_*_vibes giữ bảng suy ra mặc định trong DB (dùng ở đây và trong seed dev); Java có bản
-- giống hệt ở VibeDefaults, VibeDefaultsIT kiểm tra hai bản khớp nhau.

CREATE FUNCTION default_place_vibes(place_type VARCHAR, price VARCHAR) RETURNS VARCHAR
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE place_type
    WHEN 'cafe' THEN 'chill'
    WHEN 'bar'  THEN 'romantic'
    ELSE CASE WHEN price IN ('high', 'luxury') THEN 'romantic' ELSE 'chill,romantic' END
  END
$$;

CREATE FUNCTION default_spot_vibes(spot_category VARCHAR) RETURNS VARCHAR
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE spot_category
    WHEN 'entertainment' THEN 'active'
    WHEN 'workshop'      THEN 'romantic'
    WHEN 'museum'        THEN 'chill'
    WHEN 'outdoor'       THEN 'chill,romantic'
    WHEN 'show'          THEN 'romantic'
    WHEN 'night_market'  THEN 'active'
    WHEN 'sport'         THEN 'active'
    ELSE ''
  END
$$;

ALTER TABLE place_catalog
  ADD COLUMN vibes        VARCHAR(40) NOT NULL DEFAULT '',
  ADD COLUMN vibes_source VARCHAR(10) NOT NULL DEFAULT 'default';
UPDATE place_catalog SET vibes = default_place_vibes(type, price_range);
ALTER TABLE place_catalog
  ADD CONSTRAINT ck_catalog_vibes        CHECK (vibes ~ '^((chill|active|romantic)(,(chill|active|romantic))*)?$'),
  ADD CONSTRAINT ck_catalog_vibes_source CHECK (vibes_source IN ('default', 'claude', 'admin'));

ALTER TABLE date_spots
  ADD COLUMN vibes        VARCHAR(40) NOT NULL DEFAULT '',
  ADD COLUMN vibes_source VARCHAR(10) NOT NULL DEFAULT 'default';
UPDATE date_spots SET vibes = default_spot_vibes(category);
ALTER TABLE date_spots
  ADD CONSTRAINT ck_spot_vibes        CHECK (vibes ~ '^((chill|active|romantic)(,(chill|active|romantic))*)?$'),
  ADD CONSTRAINT ck_spot_vibes_source CHECK (vibes_source IN ('default', 'claude', 'admin'));
