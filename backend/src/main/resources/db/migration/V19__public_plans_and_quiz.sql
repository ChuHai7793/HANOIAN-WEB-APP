-- V19: mở app cho khách.
--   plans.share_token : link xem plan công khai (/p/<token>), NULL = chưa chia sẻ; chủ plan bật / tắt được
--   users.date_vibe   : kết quả quiz "Gu hẹn hò" (chill / active / romantic), dùng làm kiểu hẹn mặc định

ALTER TABLE plans ADD COLUMN share_token VARCHAR(32) NULL;
ALTER TABLE plans ADD CONSTRAINT uk_plan_share_token UNIQUE (share_token);

ALTER TABLE users ADD COLUMN date_vibe VARCHAR(10) NULL;
ALTER TABLE users ADD CONSTRAINT ck_user_date_vibe CHECK (date_vibe IS NULL OR date_vibe IN ('chill', 'active', 'romantic'));
