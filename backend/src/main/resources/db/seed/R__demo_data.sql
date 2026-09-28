-- R__demo_data.sql: dữ liệu mẫu, CHỈ chạy ở profile dev (xem application-dev.yml).
-- Idempotent: xoá user demo (cascade) rồi nạp lại. Đăng nhập: demo@gfmaster.local / Demo@12345
-- Flyway chạy lại file này mỗi khi nội dung thay đổi, nên sửa file sẽ reset dữ liệu của user demo.
--
-- Quán là quán thật ở Hà Nội, ảnh trong backend/seed-assets/ (SeedAssetLoader nạp vào /uploads/seed/).
-- Tên, địa chỉ, giờ mở cửa, toạ độ tra từ trang của quán và Foody/PasGo/toidicafe/dicaphekhong (09/2026);
-- toạ độ chưa xác minh được thì để NULL. Quán nhiều cơ sở chỉ lấy một cơ sở. Giờ có nghỉ trưa thì
-- open/close là giờ mở sớm nhất và đóng muộn nhất, giờ nghỉ ghi trong note. rating, price_range,
-- has_wifi/has_parking là đánh giá cá nhân mẫu, không phải dữ liệu của quán.

DELETE FROM users WHERE email = 'demo@gfmaster.local';

SET @uid = '00000000-0000-4000-8000-000000000001';
SET @now = '2026-01-01 00:00:00';

INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at, version) VALUES
  (@uid, 'demo@gfmaster.local', '$2a$12$y0orC.uqlK5of.r.7XJejO9tlJRlzCHb/6W05j8.OmcJZJtZEImNW', 'Demo', @now, @now, 0);

INSERT INTO places (id, user_id, type, name, address, price_range, rating, open_time, close_time,
                    image_url, note, google_maps_url, lat, lng, has_wifi, has_parking, cuisine,
                    created_at, updated_at, version) VALUES
('10000000-0000-4000-8000-000000000001', @uid, 'cafe', 'Tiệm Cà Phê Thư Báo', '27 ngõ 198 Thái Thịnh, Láng Hạ, Đống Đa',
   'medium', 5, '07:30', '23:00', '/uploads/seed/ca-phe-thu-bao.webp',
   'Cà phê 3 tầng phong cách thời bao cấp, trưng bày hàng nghìn lá thư tay xưa; yên tĩnh, hợp đọc sách.',
   'https://www.google.com/maps/@21.0143,105.8150,17z', 21.0143, 105.8150, NULL, NULL, NULL, @now, @now, 0),
  ('10000000-0000-4000-8000-000000000002', @uid, 'cafe', 'Chaly Cuc''cu Coffee', '65 Nguyễn Khang, Trung Hoà, Cầu Giấy',
   'medium', 4, '08:30', '23:00', '/uploads/seed/chaly-cuccu.webp',
   'Nhà 3 tầng vintage kiểu châu Âu, sân vườn phía trước; có khu tô tượng, làm gốm, workshop vòng tay.',
   'https://www.google.com/maps/@21.0168,105.8028,17z', 21.0168, 105.8028, NULL, NULL, NULL, @now, @now, 0),
  ('10000000-0000-4000-8000-000000000003', @uid, 'cafe', 'Cafe Cuối Ngõ', 'Số 4 ngách 78 ngõ 68 Cầu Giấy, Quan Hoa, Cầu Giấy',
   'cheap', 5, '08:30', '22:30', '/uploads/seed/cuoi-ngo.webp',
   'Nhà cổ sâu trong ngõ, gắn với nhạc Trịnh; tường treo ảnh đen trắng và chân dung cũ.',
   'https://www.google.com/maps/@21.0322,105.8015,17z', 21.0322, 105.8015, NULL, NULL, NULL, @now, @now, 0),
  ('10000000-0000-4000-8000-000000000004', @uid, 'cafe', 'Echoes Café', '18 ngõ 267 Hoàng Hoa Thám, Ba Đình',
   'medium', 4, '08:00', '23:00', '/uploads/seed/echoes-cafe.webp',
   'Trang trí cổ điển châu Âu: giấy dán tường hoa văn, tranh sơn dầu khung vàng, sofa nhung.',
   'https://www.google.com/maps/search/?api=1&query=Echoes%20Caf%C3%A9%2018%20ng%C3%B5%20267%20Ho%C3%A0ng%20Hoa%20Th%C3%A1m%2C%20Ba%20%C4%90%C3%ACnh', NULL, NULL, NULL, NULL, NULL, @now, @now, 0),
  ('10000000-0000-4000-8000-000000000005', @uid, 'cafe', 'LỐI NHỎ Kafe', 'Số 1 ngõ 189 Giảng Võ, Ba Đình',
   'medium', 4, '08:00', '23:00', '/uploads/seed/loi-nho.webp',
   'Chuỗi cà phê trong nhà nhiều tầng phong cách vintage châu Âu, nhiều góc chụp ảnh (có nhiều cơ sở).',
   'https://www.google.com/maps/@21.0243,105.8210,17z', 21.0243, 105.8210, NULL, NULL, NULL, @now, @now, 0),
  ('10000000-0000-4000-8000-000000000006', @uid, 'cafe', 'Mai Haus Coffee', 'Số 2 ngõ 4 Đặng Văn Ngữ, Kim Liên, Đống Đa',
   'medium', 4, '08:00', '23:00', '/uploads/seed/mai-haus.webp',
   'Biệt thự tường gạch cũ, cửa vòm gỗ, trang trí đồ cổ như máy đánh chữ và kệ sách.',
   'https://www.google.com/maps/search/?api=1&query=Mai%20Haus%20Coffee%20S%E1%BB%91%202%20ng%C3%B5%204%20%C4%90%E1%BA%B7ng%20V%C4%83n%20Ng%E1%BB%AF%2C%20Kim%20Li%C3%AAn%2C%20%C4%90%E1%BB%91ng%20%C4%90a', NULL, NULL, NULL, NULL, NULL, @now, @now, 0),
  ('10000000-0000-4000-8000-000000000007', @uid, 'cafe', 'Nhà Của Mậu', 'Số 7 ngõ Núi Trúc, Kim Mã, Ba Đình',
   'medium', 5, '07:30', '22:00', '/uploads/seed/nha-cua-mau.webp',
   'Cà phê kiêm tiệm hoa, có mèo; ngõ nhỏ nhiều cây xanh, lối đi lát gạch, ghế gỗ thấp.',
   'https://www.google.com/maps/@21.0303,105.8229,17z', 21.0303, 105.8229, NULL, NULL, NULL, @now, @now, 0),
  ('10000000-0000-4000-8000-000000000008', @uid, 'cafe', 'Tầm Xuân Coffee', '131 Yên Hòa, Cầu Giấy',
   'cheap', 4, '08:30', '21:00', '/uploads/seed/tam-xuan.webp',
   'Không gian rất rộng, có phòng kính riêng, bàn cao, ổ cắm và đèn bàn; hợp làm việc, học bài.',
   'https://www.google.com/maps/@21.0231,105.7942,17z', 21.0231, 105.7942, NULL, NULL, NULL, @now, @now, 0),
  ('10000000-0000-4000-8000-000000000009', @uid, 'cafe', 'Timeline Coffee', '79 ngõ 260 Cầu Giấy, Quan Hoa, Cầu Giấy',
   'medium', 4, '08:30', '23:30', '/uploads/seed/timeline-coffee.webp',
   'Phong cách phố châu Âu cổ, cửa vòm kính màu, đèn lồng; tối có quầy bar cocktail (biển Valhalla Bar).',
   'https://www.google.com/maps/@21.0354,105.7962,17z', 21.0354, 105.7962, NULL, NULL, NULL, @now, @now, 0),
  ('10000000-0000-4000-8000-000000000010', @uid, 'cafe', 'Tiny Post Cafe', 'Số 30 ngõ 181 Trường Chinh, Đống Đa',
   'medium', 4, '08:00', '22:30', '/uploads/seed/tiny-post-cafe.webp',
   'Cà phê sách 3 tầng phong cách bưu điện cổ: tường vàng cam, ban công xanh, bốt điện thoại đỏ.',
   'https://www.google.com/maps/@21.0010,105.8268,17z', 21.0010, 105.8268, NULL, NULL, NULL, @now, @now, 0),
  ('10000000-0000-4000-8000-000000000011', @uid, 'bar', 'Bar Dinh Rooftop & Lounge', 'Tầng 13, 105 Nguyễn Trường Tộ, Trúc Bạch, Ba Đình',
   'high', 5, '16:30', '00:00', '/uploads/seed/bar-dinh-rooftop.webp',
   'Rooftop tầng 13 nhìn ra hồ, mái lá và đèn xanh; cocktail signature từ nguyên liệu Việt, có nhạc sống.',
   'https://www.google.com/maps/@21.0431,105.8410,17z', 21.0431, 105.8410, NULL, NULL, NULL, @now, @now, 0),
  ('10000000-0000-4000-8000-000000000012', @uid, 'restaurant', 'Huy Go Cook', '257 Trần Đại Nghĩa, Đồng Tâm, Hai Bà Trưng',
   'cheap', 4, '10:00', '19:30', '/uploads/seed/huy-go-cook.webp',
   'Chuỗi đồ ăn đường phố Hàn Quốc giá bình dân, nổi bật với cơm Hàn; biển neon tiếng Hàn.',
   'https://www.google.com/maps/@20.9971,105.8438,17z', 20.9971, 105.8438, NULL, NULL, 'Món Hàn', @now, @now, 0),
  ('10000000-0000-4000-8000-000000000013', @uid, 'restaurant', 'Kampong Chicken House', '107 Lò Đúc, Hai Bà Trưng',
   'medium', 5, '10:30', '21:30', '/uploads/seed/kampong-chicken-house.webp',
   'Cơm gà Hải Nam kiểu Singapore, gà ta tươi, nước sốt làm mới mỗi ngày. Nghỉ trưa 14:30–17:30.',
   'https://www.google.com/maps/@21.0149,105.8570,17z', 21.0149, 105.8570, NULL, NULL, 'Món Trung', @now, @now, 0),
  ('10000000-0000-4000-8000-000000000014', @uid, 'restaurant', 'Mokchang Signature', '45 Nguyễn Khang, Cầu Giấy',
   'medium', 4, '09:30', '21:15', '/uploads/seed/mokchang-signature.webp',
   'Đồ ăn Hàn Quốc và gà rán đẫm sốt, không gian tông vàng.',
   'https://www.google.com/maps/@21.0167,105.8031,17z', 21.0167, 105.8031, NULL, NULL, 'Món Hàn', @now, @now, 0),
  ('10000000-0000-4000-8000-000000000015', @uid, 'restaurant', 'Phát Ký', '42C Lý Thường Kiệt, Hoàn Kiếm',
   'medium', 5, '09:00', '20:30', '/uploads/seed/phat-ky.webp',
   'Mì gia kiểu Sài Gòn và dimsum Hồng Kông: mì hoành thánh, mì vịt tiềm, há cảo. Nghỉ trưa 13:30–17:00.',
   'https://www.google.com/maps/@21.0235,105.8501,17z', 21.0235, 105.8501, NULL, NULL, 'Món Trung', @now, @now, 0),
  ('10000000-0000-4000-8000-000000000016', @uid, 'restaurant', 'Vị Quảng', '35 Trần Hưng Đạo, Phan Chu Trinh, Hoàn Kiếm',
   'medium', 4, '10:30', '21:00', '/uploads/seed/vi-quang.webp',
   'Món xứ Quảng: nem lụi, mì Quảng, bánh khọt; tường vàng, đèn lồng kiểu Hội An. Nghỉ trưa 14:00–17:30.',
   'https://www.google.com/maps/@21.0203,105.8543,17z', 21.0203, 105.8543, NULL, NULL, 'Món Việt', @now, @now, 0);

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
  ('20000000-0000-4000-8000-000000000002', 1, 'Đi bộ hồ Gươm');

INSERT INTO place_links (id, girlfriend_id, place_id, her_rating, last_visited_at, memory,
                         created_at, updated_at, version) VALUES
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   5, '2025-12-24', 'Ngồi tầng 3 cả chiều Giáng sinh, nàng đọc hết cả chồng thư cũ.', @now, @now, 0),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000015',
   5, '2025-11-20', 'Lần đầu ăn mì vịt tiềm, nàng xin thêm há cảo mang về.', @now, @now, 0),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003',
   4, '2026-01-10', 'Nghe nhạc Trịnh cả buổi, nhưng cuối tuần hơi đông.', @now, @now, 0),
  ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000014',
   5, '2026-01-05', 'Ăn gà rán sốt tới no căng, cười suốt buổi.', @now, @now, 0);
