-- V3: phân quyền admin / guest.
--   ADMIN: chủ dữ liệu, được thêm/sửa/xoá.
--   GUEST: chỉ xem dữ liệu của owner_id (một admin). Tài khoản đăng ký mới là GUEST.
-- Tài khoản có sẵn giữ nguyên dữ liệu của mình nên mặc định là ADMIN.
-- username: đăng nhập bằng tên ngắn (admin, guest) ngoài email; NULL = chỉ đăng nhập bằng email.

ALTER TABLE users
  ADD COLUMN username VARCHAR(50) NULL AFTER email,
  ADD COLUMN role     VARCHAR(10) NOT NULL DEFAULT 'ADMIN' AFTER display_name,
  ADD COLUMN owner_id UUID NULL AFTER role,
  ADD CONSTRAINT uk_users_username UNIQUE (username),
  ADD CONSTRAINT fk_users_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;
