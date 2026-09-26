-- R__demo_data.sql: dữ liệu mẫu, CHỈ chạy ở profile dev (xem application-dev.yml).
-- Port từ frontend/src/app/core/data/seed.ts. Idempotent: xoá user demo (cascade) rồi nạp lại.
-- Đăng nhập: demo@gfmaster.local / Demo@12345
-- Flyway chạy lại file này mỗi khi nội dung thay đổi, nên sửa file sẽ reset dữ liệu của user demo.

DELETE FROM users WHERE email = 'demo@gfmaster.local';

SET @uid = '00000000-0000-4000-8000-000000000001';
SET @now = '2026-01-01 00:00:00';

INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at, version) VALUES
  (@uid, 'demo@gfmaster.local', '$2a$12$y0orC.uqlK5of.r.7XJejO9tlJRlzCHb/6W05j8.OmcJZJtZEImNW', 'Demo', @now, @now, 0);

INSERT INTO places (id, user_id, type, name, address, price_range, rating, open_time, close_time,
                    image_url, note, google_maps_url, lat, lng, has_wifi, has_parking, cuisine,
                    created_at, updated_at, version) VALUES
  ('10000000-0000-4000-8000-000000000001', @uid, 'cafe', 'The Workshop Coffee', '27 Ngô Đức Kế, Bến Nghé, Quận 1',
   'high', 5, '08:00', '22:00', 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=600&q=80',
   'Specialty coffee, không gian gác lửng rộng, hợp ngồi lâu.',
   'https://www.google.com/maps/@10.7743,106.7043,17z', 10.7743, 106.7043, TRUE, FALSE, NULL, @now, @now, 0),
  ('10000000-0000-4000-8000-000000000002', @uid, 'cafe', 'Katinat Saigon Kafe', '91 Đồng Khởi, Bến Nghé, Quận 1',
   'medium', 4, '07:00', '23:00', 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=600&q=80',
   'View nhà thờ Đức Bà, buổi tối lên đèn rất tình.',
   'https://www.google.com/maps/@10.7776,106.7018,17z', 10.7776, 106.7018, TRUE, TRUE, NULL, @now, @now, 0),
  ('10000000-0000-4000-8000-000000000003', @uid, 'cafe', 'Cộng Cà Phê', '26 Lý Tự Trọng, Bến Nghé, Quận 1',
   'medium', 4, '07:30', '23:00', 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=600&q=80',
   'Cốt dừa cà phê huyền thoại, decor hoài cổ dễ chụp ảnh.',
   'https://www.google.com/maps/@10.7794,106.6989,17z', 10.7794, 106.6989, TRUE, FALSE, NULL, @now, @now, 0),
  ('10000000-0000-4000-8000-000000000004', @uid, 'cafe', 'Phúc Long Coffee & Tea', '152 Phan Xích Long, Phú Nhuận',
   'cheap', 3, '07:00', '22:30', 'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=600&q=80',
   'Trà đào ổn, chỗ ngồi hơi chật giờ cao điểm.',
   'https://www.google.com/maps/@10.8018,106.6836,17z', 10.8018, 106.6836, TRUE, TRUE, NULL, @now, @now, 0),
  ('10000000-0000-4000-8000-000000000005', @uid, 'bar', 'Chill Skybar', '76A Lê Lai, Bến Thành, Quận 1',
   'luxury', 5, '17:30', '02:00', 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=600&q=80',
   'Rooftop view toàn thành phố. Dress code lịch sự, nên đặt bàn trước.',
   'https://www.google.com/maps/@10.7699,106.6934,17z', 10.7699, 106.6934, TRUE, TRUE, NULL, @now, @now, 0),
  ('10000000-0000-4000-8000-000000000006', @uid, 'bar', 'Broma Not A Bar', '41 Nguyễn Huệ, Bến Nghé, Quận 1',
   'high', 4, '18:00', '01:00', 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=600&q=80',
   'Nhạc sống cuối tuần, ban công nhìn xuống phố đi bộ.',
   'https://www.google.com/maps/@10.7737,106.7043,17z', 10.7737, 106.7043, FALSE, FALSE, NULL, @now, @now, 0),
  ('10000000-0000-4000-8000-000000000007', @uid, 'restaurant', 'Pizza 4P''s Lê Thánh Tôn', '8/15 Lê Thánh Tôn, Bến Nghé, Quận 1',
   'high', 5, '10:00', '22:00', 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=80',
   'Phô mai burrata nhà làm. Nhớ đặt bàn trước cuối tuần.',
   'https://www.google.com/maps/@10.7793,106.7024,17z', 10.7793, 106.7024, NULL, NULL, 'Món Âu', @now, @now, 0),
  ('10000000-0000-4000-8000-000000000008', @uid, 'restaurant', 'Gogi House', '35 Nguyễn Trãi, Phường 2, Quận 5',
   'medium', 4, '10:00', '22:00', 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=600&q=80',
   'Buffet nướng Hàn, đi đông vui hơn đi hai người.',
   'https://www.google.com/maps/@10.7561,106.6721,17z', 10.7561, 106.6721, NULL, NULL, 'Nướng BBQ', @now, @now, 0),
  ('10000000-0000-4000-8000-000000000009', @uid, 'restaurant', 'Quán Bụi Bistro', '17A Ngô Văn Năm, Bến Nghé, Quận 1',
   'high', 4, '09:00', '23:00', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&q=80',
   'Món Việt trình bày đẹp, không gian yên tĩnh hợp nói chuyện.',
   'https://www.google.com/maps/@10.7809,106.7051,17z', 10.7809, 106.7051, NULL, NULL, 'Món Việt', @now, @now, 0),
  ('10000000-0000-4000-8000-00000000000a', @uid, 'restaurant', 'Lẩu Tự Chọn Kichi Kichi', '242 Điện Biên Phủ, Bình Thạnh',
   'medium', 3, '10:30', '22:00', 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&q=80',
   'Lẩu băng chuyền, hợp hôm trời mưa.',
   'https://www.google.com/maps/@10.8005,106.7118,17z', 10.8005, 106.7118, NULL, NULL, 'Lẩu', @now, @now, 0);

INSERT INTO girlfriends (id, user_id, name, nickname, avatar_url, birthday, phone, status, started_date, note,
                         created_at, updated_at, version) VALUES
  ('20000000-0000-4000-8000-000000000001', @uid, 'Nguyễn Thanh Mai', 'Mèo',
   'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&q=80', '1999-04-12', '0901234567',
   'dating', '2025-02-14', 'Không ăn được cay. Thích quán yên tĩnh, ghét chỗ đông.', @now, @now, 0),
  ('20000000-0000-4000-8000-000000000002', @uid, 'Trần Bảo Ngọc', 'Ngọc Bơ',
   'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=300&q=80', '2001-09-30', '0912345678',
   'crush', '2025-11-01', 'Mới quen, còn đang tìm hiểu. Rất thích đồ nướng.', @now, @now, 0);

INSERT INTO girlfriend_hobbies (girlfriend_id, position, hobby) VALUES
  ('20000000-0000-4000-8000-000000000001', 0, 'Cà phê sáng'),
  ('20000000-0000-4000-8000-000000000001', 1, 'Xem phim'),
  ('20000000-0000-4000-8000-000000000001', 2, 'Chụp ảnh film'),
  ('20000000-0000-4000-8000-000000000002', 0, 'Trà sữa'),
  ('20000000-0000-4000-8000-000000000002', 1, 'Đi bộ Nguyễn Huệ');

INSERT INTO place_links (id, girlfriend_id, place_id, her_rating, last_visited_at, memory,
                         created_at, updated_at, version) VALUES
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   5, '2025-12-24', 'Ngồi gác lửng cả buổi chiều Giáng sinh, nàng khen cold brew.', @now, @now, 0),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000007',
   5, '2025-11-20', 'Lần đầu ăn burrata, nàng chụp hết 30 tấm ảnh.', @now, @now, 0),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
   4, '2026-01-10', 'View nhà thờ đẹp nhưng hơi ồn.', @now, @now, 0),
  ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000008',
   5, '2026-01-05', 'Ăn nướng tới no căng, cười suốt buổi.', @now, @now, 0);
