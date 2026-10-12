-- R__sample_dating_users.sql: 10 người dùng mẫu (5 nam, 5 nữ) để thử "Tìm đối tượng", CHỈ chạy ở profile dev.
-- Danh sách đăng nhập ở samples.md (thư mục gốc). Mật khẩu chung: sample@12345.
-- Tên file xếp sau R__demo_data.sql nên chạy sau, khi admin (owner của các GUEST) đã có.
-- Idempotent: xoá các user mẫu (cascade hồ sơ, quẹt, match, tin nhắn) rồi nạp lại.
--
-- Id cố định 00000000-0000-4000-8000-0000000001NN: 01–05 nam, 06–10 nữ.
-- Ảnh là link ngoài của randomuser.me (ImageUrls giữ nguyên link http(s)).

DELETE FROM users
WHERE id::text LIKE '00000000-0000-4000-8000-0000000001__'
   OR username IN ('tuan', 'hoang', 'duc', 'khoa', 'long', 'linh', 'trang', 'ngoc', 'mai', 'ha')
   OR email LIKE '%@sample.gfmaster.local';

INSERT INTO users (id, email, username, password_hash, display_name, role, owner_id, created_at, updated_at, version) VALUES
  ('00000000-0000-4000-8000-000000000101', 'tuan@sample.gfmaster.local',  'tuan',  '$2a$12$B/NMyQZ3k3MY.8cdO4W9ZOES1GGcGZctHLY8G2D.It5Veqyr1mkT.', 'Minh Tuấn',  'GUEST', '00000000-0000-4000-8000-000000000001', '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0),
  ('00000000-0000-4000-8000-000000000102', 'hoang@sample.gfmaster.local', 'hoang', '$2a$12$oWxedRcJMofxgR0vQWpBJuGFN2p.h3Rn72IaLKY8VmHoxgnuEAp32', 'Huy Hoàng',  'GUEST', '00000000-0000-4000-8000-000000000001', '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0),
  ('00000000-0000-4000-8000-000000000103', 'duc@sample.gfmaster.local',   'duc',   '$2a$12$8zZ1r/fktdKhUhYh97yZze4tsbdb5ov6lz2YT21ivHUvKYleEmhLu', 'Anh Đức',    'GUEST', '00000000-0000-4000-8000-000000000001', '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0),
  ('00000000-0000-4000-8000-000000000104', 'khoa@sample.gfmaster.local',  'khoa',  '$2a$12$KZeymG/Vgfl2/sJz3cpkgOvoTzj/RBUJicEfv367cS/KbLSjKrgCm', 'Đăng Khoa',  'GUEST', '00000000-0000-4000-8000-000000000001', '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0),
  ('00000000-0000-4000-8000-000000000105', 'long@sample.gfmaster.local',  'long',  '$2a$12$SXPyoOv9g3QxR4scHOIV.OLpJD.lBk2/sEgLMLyf2rIhn.g0bSLHS', 'Thành Long', 'GUEST', '00000000-0000-4000-8000-000000000001', '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0),
  ('00000000-0000-4000-8000-000000000106', 'linh@sample.gfmaster.local',  'linh',  '$2a$12$1W4SX4Gm6fjJeOE3Loyy9uKXjUUSWY9qou1zLlHNbSGj4SPJbseVO', 'Thùy Linh',  'GUEST', '00000000-0000-4000-8000-000000000001', '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0),
  ('00000000-0000-4000-8000-000000000107', 'trang@sample.gfmaster.local', 'trang', '$2a$12$.sp.MhoeT5dVBeoUHW4AaOI2oPGcxrJxpAbtFnnxKZxzBIFCw8p9y', 'Minh Trang', 'GUEST', '00000000-0000-4000-8000-000000000001', '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0),
  ('00000000-0000-4000-8000-000000000108', 'ngoc@sample.gfmaster.local',  'ngoc',  '$2a$12$qIdvH8vBHRJuxakqNxj1je5Wbm/L4365hKMNWVx05i3Cu.0AczFmO', 'Bảo Ngọc',   'GUEST', '00000000-0000-4000-8000-000000000001', '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0),
  ('00000000-0000-4000-8000-000000000109', 'mai@sample.gfmaster.local',   'mai',   '$2a$12$mIhbY1G.oUGKQlrRxe0VGuEJfxbLI0Ug7JEiaBbFgXyxVgkIMYeKy', 'Thanh Mai',  'GUEST', '00000000-0000-4000-8000-000000000001', '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0),
  ('00000000-0000-4000-8000-000000000110', 'ha@sample.gfmaster.local',    'ha',    '$2a$12$v/HtLNGEcKgihfH.0bYT2u1FzmIJLvkXLnmrAUd6FqLmS1eWttG3q', 'Thu Hà',     'GUEST', '00000000-0000-4000-8000-000000000001', '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0);

-- Hồ sơ đã hoàn tất và đã bật "Tìm đối tượng": nam muốn gặp nữ, nữ muốn gặp nam, tuổi 18–40
INSERT INTO user_profiles (user_id, avatar_url, birthday, gender, phone, city, bio, completed_at,
                           dating_enabled, interested_in, age_min, age_max, same_city_only,
                           created_at, updated_at, version) VALUES
  ('00000000-0000-4000-8000-000000000101', 'https://randomuser.me/api/portraits/men/32.jpg', '1996-03-14', 'male', NULL, 'Hà Nội',
   'Kỹ sư phần mềm, cuối tuần hay đi cà phê sách. Tìm người cùng thích yên tĩnh.', '2026-01-01 00:00:00',
   true, 'female', 18, 40, false, '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0),
  ('00000000-0000-4000-8000-000000000102', 'https://randomuser.me/api/portraits/men/45.jpg', '1998-07-02', 'male', NULL, 'Hà Nội',
   'Mê bóng đá và đồ nướng. Rủ đi ăn là đi liền.', '2026-01-01 00:00:00',
   true, 'female', 18, 40, false, '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0),
  ('00000000-0000-4000-8000-000000000103', 'https://randomuser.me/api/portraits/men/22.jpg', '1994-11-20', 'male', NULL, 'Hà Nội',
   'Nhiếp ảnh nghiệp dư, thích đi phượt và săn bình minh.', '2026-01-01 00:00:00',
   true, 'female', 18, 40, false, '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0),
  ('00000000-0000-4000-8000-000000000104', 'https://randomuser.me/api/portraits/men/67.jpg', '2000-05-09', 'male', NULL, 'Hà Nội',
   'Sinh viên năm cuối, chơi guitar, hay ngồi rooftop nghe nhạc.', '2026-01-01 00:00:00',
   true, 'female', 18, 40, false, '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0),
  ('00000000-0000-4000-8000-000000000105', 'https://randomuser.me/api/portraits/men/11.jpg', '1997-01-28', 'male', NULL, 'TP. Hồ Chí Minh',
   'Làm marketing, nghiện cà phê muối và gym buổi sáng.', '2026-01-01 00:00:00',
   true, 'female', 18, 40, false, '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0),
  ('00000000-0000-4000-8000-000000000106', 'https://randomuser.me/api/portraits/women/44.jpg', '1999-04-12', 'female', NULL, 'Hà Nội',
   'Thích đọc sách, nuôi hai bé mèo. Không ăn được cay.', '2026-01-01 00:00:00',
   true, 'male', 18, 40, false, '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0),
  ('00000000-0000-4000-8000-000000000107', 'https://randomuser.me/api/portraits/women/65.jpg', '1997-08-23', 'female', NULL, 'Hà Nội',
   'Designer, mê quán vintage và chụp ảnh film.', '2026-01-01 00:00:00',
   true, 'male', 18, 40, false, '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0),
  ('00000000-0000-4000-8000-000000000108', 'https://randomuser.me/api/portraits/women/26.jpg', '2001-12-05', 'female', NULL, 'Hà Nội',
   'Hát karaoke dở nhưng nhiệt. Thích đồ Hàn và trà sữa.', '2026-01-01 00:00:00',
   true, 'male', 18, 40, false, '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0),
  ('00000000-0000-4000-8000-000000000109', 'https://randomuser.me/api/portraits/women/12.jpg', '1998-02-17', 'female', NULL, 'Hà Nội',
   'Giáo viên tiếng Anh, cuối tuần học làm bánh.', '2026-01-01 00:00:00',
   true, 'male', 18, 40, false, '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0),
  ('00000000-0000-4000-8000-000000000110', 'https://randomuser.me/api/portraits/women/90.jpg', '1995-06-30', 'female', NULL, 'TP. Hồ Chí Minh',
   'Thích chạy bộ, yoga và những chuyến đi biển.', '2026-01-01 00:00:00',
   true, 'male', 18, 40, false, '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0);

INSERT INTO profile_photos (user_id, position, url) VALUES
  ('00000000-0000-4000-8000-000000000101', 0, 'https://randomuser.me/api/portraits/men/32.jpg'),
  ('00000000-0000-4000-8000-000000000102', 0, 'https://randomuser.me/api/portraits/men/45.jpg'),
  ('00000000-0000-4000-8000-000000000103', 0, 'https://randomuser.me/api/portraits/men/22.jpg'),
  ('00000000-0000-4000-8000-000000000104', 0, 'https://randomuser.me/api/portraits/men/67.jpg'),
  ('00000000-0000-4000-8000-000000000105', 0, 'https://randomuser.me/api/portraits/men/11.jpg'),
  ('00000000-0000-4000-8000-000000000106', 0, 'https://randomuser.me/api/portraits/women/44.jpg'),
  ('00000000-0000-4000-8000-000000000107', 0, 'https://randomuser.me/api/portraits/women/65.jpg'),
  ('00000000-0000-4000-8000-000000000108', 0, 'https://randomuser.me/api/portraits/women/26.jpg'),
  ('00000000-0000-4000-8000-000000000109', 0, 'https://randomuser.me/api/portraits/women/12.jpg'),
  ('00000000-0000-4000-8000-000000000110', 0, 'https://randomuser.me/api/portraits/women/90.jpg');

INSERT INTO profile_interests (user_id, position, interest) VALUES
  ('00000000-0000-4000-8000-000000000101', 0, 'Cà phê sách'), ('00000000-0000-4000-8000-000000000101', 1, 'Lập trình'), ('00000000-0000-4000-8000-000000000101', 2, 'Board game'),
  ('00000000-0000-4000-8000-000000000102', 0, 'Bóng đá'),     ('00000000-0000-4000-8000-000000000102', 1, 'Đồ nướng'),  ('00000000-0000-4000-8000-000000000102', 2, 'Du lịch'),
  ('00000000-0000-4000-8000-000000000103', 0, 'Nhiếp ảnh'),   ('00000000-0000-4000-8000-000000000103', 1, 'Phượt'),     ('00000000-0000-4000-8000-000000000103', 2, 'Cà phê'),
  ('00000000-0000-4000-8000-000000000104', 0, 'Guitar'),      ('00000000-0000-4000-8000-000000000104', 1, 'Rooftop'),   ('00000000-0000-4000-8000-000000000104', 2, 'Âm nhạc'),
  ('00000000-0000-4000-8000-000000000105', 0, 'Gym'),         ('00000000-0000-4000-8000-000000000105', 1, 'Cà phê'),    ('00000000-0000-4000-8000-000000000105', 2, 'Marketing'),
  ('00000000-0000-4000-8000-000000000106', 0, 'Đọc sách'),    ('00000000-0000-4000-8000-000000000106', 1, 'Mèo'),       ('00000000-0000-4000-8000-000000000106', 2, 'Cà phê sách'),
  ('00000000-0000-4000-8000-000000000107', 0, 'Vintage'),     ('00000000-0000-4000-8000-000000000107', 1, 'Chụp ảnh film'), ('00000000-0000-4000-8000-000000000107', 2, 'Cà phê'),
  ('00000000-0000-4000-8000-000000000108', 0, 'Karaoke'),     ('00000000-0000-4000-8000-000000000108', 1, 'Món Hàn'),   ('00000000-0000-4000-8000-000000000108', 2, 'Trà sữa'),
  ('00000000-0000-4000-8000-000000000109', 0, 'Làm bánh'),    ('00000000-0000-4000-8000-000000000109', 1, 'Tiếng Anh'), ('00000000-0000-4000-8000-000000000109', 2, 'Đọc sách'),
  ('00000000-0000-4000-8000-000000000110', 0, 'Chạy bộ'),     ('00000000-0000-4000-8000-000000000110', 1, 'Yoga'),      ('00000000-0000-4000-8000-000000000110', 2, 'Du lịch');

-- My place: chép quán từ "Khám phá quán" mẫu (id 4000...NN của R__demo_data.sql) để có "Cùng lưu" và
-- "Hợp gu %". Tuấn hợp gu nhất với Linh (3 quán chung), Trang (2), Mai (1); Khoa và Ngọc trùng cả 3 quán.
-- R__demo_data.sql ghi đè quán mẫu giữ nguyên id (không xoá) nên chạy lại file đó không làm mất liên kết ở đây.
INSERT INTO places (id, user_id, catalog_id, type, name, address, price_range, rating, open_time, close_time,
                    image_url, note, google_maps_url, lat, lng, has_wifi, has_parking, cuisine,
                    created_at, updated_at, version)
SELECT gen_random_uuid(), ('00000000-0000-4000-8000-000000000' || s.u)::uuid, c.id, c.type, c.name, c.address,
       c.price_range, c.rating, c.open_time, c.close_time, c.image_url, c.note, c.google_maps_url, c.lat, c.lng,
       c.has_wifi, c.has_parking, c.cuisine, '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0
FROM (VALUES
  ('101', '01'), ('101', '02'), ('101', '03'), ('101', '07'), ('101', '09'),  -- Tuấn
  ('102', '03'), ('102', '12'), ('102', '13'), ('102', '15'),                 -- Hoàng
  ('103', '01'), ('103', '03'), ('103', '04'), ('103', '10'),                 -- Đức
  ('104', '11'), ('104', '12'), ('104', '14'), ('104', '16'),                 -- Khoa
  ('105', '05'), ('105', '06'),                                               -- Long
  ('106', '01'), ('106', '03'), ('106', '07'), ('106', '10'),                 -- Linh
  ('107', '02'), ('107', '04'), ('107', '05'), ('107', '09'),                 -- Trang
  ('108', '11'), ('108', '12'), ('108', '14'),                                -- Ngọc
  ('109', '01'), ('109', '08'), ('109', '10'), ('109', '15'),                 -- Mai
  ('110', '13'), ('110', '16')                                                -- Hà
) AS s(u, n)
JOIN place_catalog c ON c.id = ('40000000-0000-4000-8000-0000000000' || s.n)::uuid;

-- Lượt thích sẵn để thử match ngay: Linh, Trang đã thích Tuấn; Hoàng, Đức đã thích Linh.
-- Đăng nhập Tuấn (hoặc Linh) rồi quẹt phải những người này là thành match.
INSERT INTO swipes (swiper_id, target_id, liked, created_at) VALUES
  ('00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-000000000101', true, '2026-01-01 00:00:00'),
  ('00000000-0000-4000-8000-000000000107', '00000000-0000-4000-8000-000000000101', true, '2026-01-01 00:00:00'),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000106', true, '2026-01-01 00:00:00'),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000106', true, '2026-01-01 00:00:00'),
  -- Khoa và Ngọc đã match, có sẵn đoạn chat
  ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000108', true, '2026-01-01 00:00:00'),
  ('00000000-0000-4000-8000-000000000108', '00000000-0000-4000-8000-000000000104', true, '2026-01-01 00:00:00');

INSERT INTO matches (id, user_a, user_b, created_at) VALUES
  ('50000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000108', '2026-01-01 00:00:00');

INSERT INTO messages (id, match_id, sender_id, body, created_at, read_at) VALUES
  ('60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000104',
   'Chào Ngọc, thấy bạn cũng thích đồ Hàn. Cuối tuần đi Mokchang không?', '2026-01-01 10:00:00', '2026-01-01 10:05:00'),
  ('60000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000108',
   'Hihi được đó, mà phải có trà sữa sau nhé!', '2026-01-01 10:06:00', NULL);
