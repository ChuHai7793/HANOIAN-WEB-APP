-- V8: "Khám phá quán" chứa mọi quán. Quán đang có trong places mà chưa thuộc danh mục (quán cũ tự nhập
-- trước khi có danh mục, ví dụ 16 quán mẫu của admin) được đưa vào place_catalog, rồi nối places.catalog_id
-- về đó (Khám phá quán hiện "Đã có trong My place").
--
-- Quán trùng tên + địa chỉ (không phân biệt hoa thường) chỉ tạo một mục; nội dung lấy từ bản tạo sớm nhất.
-- Khu vực (bắt buộc) được đoán theo thứ tự:
--   1. tên quận trong địa chỉ (có dấu hoặc không dấu), ví dụ "..., Cầu Giấy";
--   2. toạ độ, theo khung gần đúng của từng quận;
--   3. không đoán được thì HOAN_KIEM (admin sửa lại trong Khám phá quán).

CREATE TEMPORARY TABLE tmp_catalog_source AS
SELECT DISTINCT ON (lower(trim(p.name)), lower(trim(p.address)))
  gen_random_uuid() AS new_catalog_id,
  lower(trim(p.name)) AS name_key,
  lower(trim(p.address)) AS address_key,
  p.*
FROM places p
WHERE p.catalog_id IS NULL
ORDER BY lower(trim(p.name)), lower(trim(p.address)), p.created_at;

INSERT INTO place_catalog (
  id, type, district, name, address, price_range, rating, open_time, close_time, image_url, note,
  google_maps_url, lat, lng, has_wifi, has_parking, cuisine, created_at, updated_at, version)
SELECT
  s.new_catalog_id,
  s.type,
  CASE
    WHEN s.address ILIKE '%Ba Đình%'      OR s.address ILIKE '%Ba Dinh%'      THEN 'BA_DINH'
    WHEN s.address ILIKE '%Hoàn Kiếm%'    OR s.address ILIKE '%Hoan Kiem%'    THEN 'HOAN_KIEM'
    WHEN s.address ILIKE '%Tây Hồ%'       OR s.address ILIKE '%Tay Ho%'       THEN 'TAY_HO'
    WHEN s.address ILIKE '%Long Biên%'    OR s.address ILIKE '%Long Bien%'    THEN 'LONG_BIEN'
    WHEN s.address ILIKE '%Nam Từ Liêm%'  OR s.address ILIKE '%Nam Tu Liem%'  THEN 'NAM_TU_LIEM'
    WHEN s.address ILIKE '%Bắc Từ Liêm%'  OR s.address ILIKE '%Bac Tu Liem%'  THEN 'BAC_TU_LIEM'
    WHEN s.address ILIKE '%Cầu Giấy%'     OR s.address ILIKE '%Cau Giay%'     THEN 'CAU_GIAY'
    WHEN s.address ILIKE '%Đống Đa%'      OR s.address ILIKE '%Dong Da%'      THEN 'DONG_DA'
    WHEN s.address ILIKE '%Hai Bà Trưng%' OR s.address ILIKE '%Hai Ba Trung%' THEN 'HAI_BA_TRUNG'
    WHEN s.address ILIKE '%Hoàng Mai%'    OR s.address ILIKE '%Hoang Mai%'    THEN 'HOANG_MAI'
    WHEN s.address ILIKE '%Thanh Xuân%'   OR s.address ILIKE '%Thanh Xuan%'   THEN 'THANH_XUAN'
    WHEN s.address ILIKE '%Hà Đông%'      OR s.address ILIKE '%Ha Dong%'      THEN 'HA_DONG'
    -- Khung toạ độ gần đúng (nam, tây, bắc, đông); quận nhỏ ở trung tâm xét trước
    WHEN s.lat BETWEEN 21.015 AND 21.040 AND s.lng BETWEEN 105.840 AND 105.862 THEN 'HOAN_KIEM'
    WHEN s.lat BETWEEN 21.025 AND 21.050 AND s.lng BETWEEN 105.805 AND 105.845 THEN 'BA_DINH'
    WHEN s.lat BETWEEN 20.998 AND 21.032 AND s.lng BETWEEN 105.800 AND 105.845 THEN 'DONG_DA'
    WHEN s.lat BETWEEN 20.990 AND 21.020 AND s.lng BETWEEN 105.840 AND 105.875 THEN 'HAI_BA_TRUNG'
    WHEN s.lat BETWEEN 21.010 AND 21.050 AND s.lng BETWEEN 105.775 AND 105.805 THEN 'CAU_GIAY'
    WHEN s.lat BETWEEN 21.045 AND 21.095 AND s.lng BETWEEN 105.795 AND 105.850 THEN 'TAY_HO'
    WHEN s.lat BETWEEN 20.980 AND 21.005 AND s.lng BETWEEN 105.790 AND 105.830 THEN 'THANH_XUAN'
    WHEN s.lat BETWEEN 20.950 AND 20.995 AND s.lng BETWEEN 105.825 AND 105.880 THEN 'HOANG_MAI'
    WHEN s.lat BETWEEN 21.010 AND 21.075 AND s.lng BETWEEN 105.860 AND 105.935 THEN 'LONG_BIEN'
    WHEN s.lat BETWEEN 20.990 AND 21.045 AND s.lng BETWEEN 105.735 AND 105.785 THEN 'NAM_TU_LIEM'
    WHEN s.lat BETWEEN 21.040 AND 21.095 AND s.lng BETWEEN 105.730 AND 105.800 THEN 'BAC_TU_LIEM'
    WHEN s.lat BETWEEN 20.940 AND 20.995 AND s.lng BETWEEN 105.740 AND 105.800 THEN 'HA_DONG'
    ELSE 'HOAN_KIEM'
  END,
  s.name, s.address, s.price_range, s.rating, s.open_time, s.close_time, s.image_url, s.note,
  s.google_maps_url, s.lat, s.lng, s.has_wifi, s.has_parking, s.cuisine, s.created_at, now(), 0
FROM tmp_catalog_source s;

-- Nối quán trong My place về mục vừa tạo. Một người có hai quán trùng nhau thì chỉ nối một quán
-- (uk_places_user_catalog), quán còn lại vẫn ở My place nhưng không trỏ về danh mục.
UPDATE places p
SET catalog_id = pick.new_catalog_id
FROM (
  SELECT DISTINCT ON (p2.user_id, s.new_catalog_id) p2.id AS place_id, s.new_catalog_id
  FROM places p2
  JOIN tmp_catalog_source s
    ON lower(trim(p2.name)) = s.name_key AND lower(trim(p2.address)) = s.address_key
  WHERE p2.catalog_id IS NULL
  ORDER BY p2.user_id, s.new_catalog_id, p2.created_at
) pick
WHERE p.id = pick.place_id;

DROP TABLE tmp_catalog_source;
