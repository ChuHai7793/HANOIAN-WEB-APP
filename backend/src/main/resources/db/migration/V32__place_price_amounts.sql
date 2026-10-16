-- V32: giá cụ thể (VNĐ/người) cho quán, bên cạnh nhóm giá (price_range). NULL = chưa nhập, chỉ hiện nhóm giá.
-- price_to NULL = chỉ có giá từ ("Từ 80k/người"). Bản sao trong My place (places) mang cùng giá, đồng bộ khi admin sửa.
ALTER TABLE place_catalog
  ADD COLUMN price_from INT NULL,
  ADD COLUMN price_to   INT NULL,
  ADD CONSTRAINT ck_catalog_price_amount CHECK (
    (price_from IS NULL AND price_to IS NULL) OR (price_from >= 0 AND (price_to IS NULL OR price_to >= price_from)));

ALTER TABLE places
  ADD COLUMN price_from INT NULL,
  ADD COLUMN price_to   INT NULL,
  ADD CONSTRAINT ck_place_price_amount CHECK (
    (price_from IS NULL AND price_to IS NULL) OR (price_from >= 0 AND (price_to IS NULL OR price_to >= price_from)));
