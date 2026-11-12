-- V35: tìm kiếm không phân biệt dấu, index cho các truy vấn hay chạy, và không trùng vị trí điểm dừng trong plan.
--
-- 1. Tìm quán / chỗ chơi theo tên, địa chỉ bỏ dấu ("cuoi ngo" ra "Cuối Ngõ"): unaccent() của Postgres không IMMUTABLE
--    nên không đặt thẳng vào index; bọc lại với từ điển cố định rồi đánh index trigram (LIKE '%..%' dùng được index).
--    Supabase đặt extension trong schema "extensions" (có trong search_path), local / test đặt trong "public":
--    không ghi cứng schema.
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Hàm bị inline khi tạo index nên tên từ điển phải kèm schema; schema lấy từ chỗ extension thật sự được cài.
DO $do$
DECLARE ext_schema text;
BEGIN
  SELECT n.nspname INTO ext_schema
  FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'unaccent';
  EXECUTE format(
    'CREATE OR REPLACE FUNCTION immutable_unaccent(text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT '
    || 'AS $f$ SELECT %I.unaccent(%L::regdictionary, $1) $f$',
    ext_schema, ext_schema || '.unaccent');
END $do$;

CREATE INDEX ix_catalog_name_trgm    ON place_catalog USING gin (immutable_unaccent(lower(name)) gin_trgm_ops);
CREATE INDEX ix_catalog_address_trgm ON place_catalog USING gin (immutable_unaccent(lower(address)) gin_trgm_ops);
CREATE INDEX ix_spot_name_trgm       ON date_spots    USING gin (immutable_unaccent(lower(name)) gin_trgm_ops);
CREATE INDEX ix_spot_address_trgm    ON date_spots    USING gin (immutable_unaccent(lower(address)) gin_trgm_ops);

-- 2. Đếm tin chưa đọc của từng match (danh sách match, huy hiệu trên menu)
CREATE INDEX ix_message_unread ON messages (match_id, sender_id) WHERE read_at IS NULL;

-- 3. Job dọn upload: quét theo trạng thái / thời điểm, và so URL ảnh với các bảng đang dùng ảnh (trước đây mỗi so sánh
--    là một lần quét cả bảng)
CREATE INDEX ix_upload_status_created ON uploads (status, created_at);
CREATE INDEX ix_upload_created_ready  ON uploads (created_at) WHERE storage_key IS NOT NULL;
CREATE INDEX ix_places_image_url      ON places (image_url);
CREATE INDEX ix_gf_avatar_url         ON girlfriends (avatar_url);
CREATE INDEX ix_profile_avatar_url    ON user_profiles (avatar_url);
CREATE INDEX ix_spot_image_url        ON date_spots (image_url);
CREATE INDEX ix_catalog_image_url     ON place_catalog (image_url);
CREATE INDEX ix_catalog_photos_url    ON catalog_photos (url);
CREATE INDEX ix_spot_photos_url       ON spot_photos (url);
CREATE INDEX ix_articles_cover_url    ON articles (cover_url);

-- 4. Hai điểm dừng của một plan không được cùng vị trí. DEFERRABLE vì thêm điểm vào giữa (position + 1) và xếp lại
--    (cập nhật từng dòng) đi qua trạng thái trùng tạm thời trong transaction. Đánh số lại trước cho dữ liệu cũ.
UPDATE plan_stops s SET position = r.rn - 1
FROM (SELECT id, row_number() OVER (PARTITION BY plan_id ORDER BY position, id) AS rn FROM plan_stops) r
WHERE s.id = r.id AND s.position <> r.rn - 1;
ALTER TABLE plan_stops ADD CONSTRAINT uk_stop_plan_position UNIQUE (plan_id, position) DEFERRABLE INITIALLY DEFERRED;
