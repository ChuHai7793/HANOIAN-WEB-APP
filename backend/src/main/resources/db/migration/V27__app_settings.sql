-- V27: cấu hình chung admin chỉnh được trên giao diện (khoá → giá trị). Đầu tiên: ảnh nền banner Khám phá quán
-- (explore.banner = URL ảnh dạng /uploads/<key> hoặc http(s); không có dòng = dùng ảnh mặc định của frontend).
CREATE TABLE app_settings (
  key        VARCHAR(60)   NOT NULL PRIMARY KEY,
  value      VARCHAR(1024) NOT NULL,
  updated_at TIMESTAMP(6)  NOT NULL
);
