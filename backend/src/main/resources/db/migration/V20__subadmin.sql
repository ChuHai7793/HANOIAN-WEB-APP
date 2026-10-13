-- V20: tài khoản subadmin. Quyền y hệt admin (role ADMIN) và làm việc trên chính dữ liệu của admin
-- (owner_id = admin, xem User.dataOwnerId()). Mật khẩu giống admin: chép password_hash của admin lúc chạy
-- migration (admin đổi mật khẩu sau này thì subadmin vẫn giữ mật khẩu cũ).
-- Chưa có user "admin" (DB trống, test) thì không tạo gì.
INSERT INTO users (id, email, username, password_hash, display_name, role, owner_id, created_at, updated_at, version)
SELECT gen_random_uuid(), 'subadmin@gfmaster.local', 'subadmin', a.password_hash, 'Subadmin', 'ADMIN', a.id,
       now(), now(), 0
FROM users a
WHERE lower(a.username) = 'admin'
  AND NOT EXISTS (SELECT 1 FROM users u WHERE lower(u.username) = 'subadmin' OR lower(u.email) = 'subadmin@gfmaster.local');
