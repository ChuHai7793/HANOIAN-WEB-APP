-- V34: Đăng nhập bằng Google / Facebook. Tài khoản tạo qua mạng xã hội không có mật khẩu (password_hash NULL:
-- POST /auth/login trả INVALID_CREDENTIALS như sai mật khẩu). Mỗi user có thể gắn nhiều danh tính ngoài; định danh
-- bằng id cố định của nhà cung cấp (Google "sub", Facebook user id), không bằng email vì email đổi được.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

CREATE TABLE user_identities (
  id         UUID         NOT NULL PRIMARY KEY,
  user_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider   VARCHAR(20)  NOT NULL,
  subject    VARCHAR(255) NOT NULL,
  email      VARCHAR(255) NOT NULL DEFAULT '',
  created_at TIMESTAMP(6) NOT NULL,
  updated_at TIMESTAMP(6) NOT NULL,
  version    BIGINT       NOT NULL DEFAULT 0,
  CONSTRAINT uk_identity_provider_subject UNIQUE (provider, subject),
  CONSTRAINT ck_identity_provider CHECK (provider IN ('google', 'facebook'))
);
CREATE INDEX ix_identity_user ON user_identities (user_id);
