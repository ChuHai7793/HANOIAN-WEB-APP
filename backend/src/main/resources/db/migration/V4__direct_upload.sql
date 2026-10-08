-- V4: upload thẳng lên storage (presigned URL).
-- Bản ghi được tạo TRƯỚC khi có ảnh đã xử lý (status AWAITING_UPLOAD → PROCESSING → READY/FAILED),
-- nên storage_key, url, width, height để NULL cho tới khi worker xử lý xong.
-- incoming_key: ảnh gốc trong vùng lưu riêng tư, xoá sau khi xử lý.
-- size_bytes: lúc đầu là kích thước trình duyệt khai, sau khi xử lý là kích thước file WebP.

ALTER TABLE uploads
  ALTER COLUMN storage_key DROP NOT NULL,
  ALTER COLUMN url         DROP NOT NULL,
  ALTER COLUMN width       DROP NOT NULL,
  ALTER COLUMN height      DROP NOT NULL,
  ADD COLUMN incoming_key VARCHAR(255) NULL;
