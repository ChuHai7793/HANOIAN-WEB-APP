-- V2: payload import lưu trong DB thay vì storage.
-- Storage local được phục vụ công khai qua /uploads/**, không hợp để chứa JSON có tên, số điện thoại.
-- payload bị xoá (NULL) khi import xong; payload_key giữ lại cho driver S3 sau này nhưng không bắt buộc.

ALTER TABLE import_jobs
  ADD COLUMN payload LONGTEXT NULL AFTER payload_key,
  MODIFY payload_key VARCHAR(255) NULL;
