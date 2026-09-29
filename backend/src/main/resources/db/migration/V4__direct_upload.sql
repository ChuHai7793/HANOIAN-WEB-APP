-- V4: upload thẳng lên storage (presigned URL).
-- Bản ghi được tạo TRƯỚC khi có ảnh đã xử lý (status AWAITING_UPLOAD → PROCESSING → READY/FAILED),
-- nên storage_key, url, width, height để NULL cho tới khi worker xử lý xong.
-- incoming_key: ảnh gốc trong vùng lưu riêng tư, xoá sau khi xử lý.
-- size_bytes: lúc đầu là kích thước trình duyệt khai, sau khi xử lý là kích thước file WebP.

ALTER TABLE uploads
  MODIFY storage_key VARCHAR(255)  NULL,
  MODIFY url         VARCHAR(1024) NULL,
  MODIFY width       INT           NULL,
  MODIFY height      INT           NULL,
  ADD COLUMN incoming_key VARCHAR(255) NULL AFTER storage_key;
