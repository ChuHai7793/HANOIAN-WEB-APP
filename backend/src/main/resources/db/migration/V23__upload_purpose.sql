-- V23: ảnh dùng vào việc gì và tên gợi ý (tên quán, tên người…) để đặt tên file dễ đọc trên storage:
-- places/2026/10/cafe-cuoi-ngo-k3f9a1c2.webp thay cho <id người dùng>/2026/10/<uuid>.webp.
-- Trình duyệt gửi lúc bắt đầu upload; worker dùng khi lưu ảnh đã xử lý. NULL: ảnh cũ / không rõ.
ALTER TABLE uploads
  ADD COLUMN purpose   VARCHAR(12) NULL,
  ADD COLUMN name_hint VARCHAR(80) NULL;
