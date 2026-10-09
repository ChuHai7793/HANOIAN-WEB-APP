-- V5: hồ sơ cá nhân của người dùng (nhập sau khi đăng ký, sửa ở "Hồ sơ của tôi").
-- Bảng riêng thay vì thêm cột vào users: users chỉ giữ thông tin đăng nhập.
-- Chưa có dòng = người dùng chưa nhập hồ sơ. completed_at: lần đầu lưu hồ sơ.
-- avatar_url lưu dạng /uploads/<key> như places.image_url (đổi sang URL CDN khi trả ra API).

CREATE TABLE user_profiles (
  user_id      UUID          NOT NULL PRIMARY KEY,
  avatar_url   VARCHAR(1024) NULL,
  birthday     DATE          NULL,
  gender       VARCHAR(10)   NULL,
  phone        VARCHAR(20)   NULL,
  city         VARCHAR(80)   NULL,
  bio          TEXT          NOT NULL DEFAULT '',
  completed_at TIMESTAMP(6)  NULL,
  created_at   TIMESTAMP(6)  NOT NULL,
  updated_at   TIMESTAMP(6)  NOT NULL,
  version      BIGINT        NOT NULL DEFAULT 0,
  CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT ck_profile_gender CHECK (gender IN ('male','female','other'))
);
