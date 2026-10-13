-- R__demo_spots.sql: 5 chỗ chơi mẫu cho "Tìm chỗ chơi", CHỈ chạy ở profile dev (như R__demo_data.sql).
-- Idempotent: xoá các chỗ mẫu (id 7000...) rồi nạp lại.
--
-- Địa điểm thật ở Hà Nội. Địa chỉ, giờ, giá tra từ Vinpearl/Vinwonders/Vietnam Airlines/mytour (10/2026);
-- các nguồn có thể lệch nhau (ví dụ vé Văn Miếu 30k hay 70k), lấy mức mới nhất. Toạ độ chưa xác minh
-- được thì để NULL, google_maps_url là link tìm kiếm.

DELETE FROM date_spots WHERE id::text LIKE '70000000-0000-4000-8000-%';

INSERT INTO date_spots (id, category, district, name, address, description, price_from, price_to,
                        open_time, close_time, hours_note, duration_min, indoor, needs_booking, booking_url,
                        image_url, google_maps_url, lat, lng, created_at, updated_at, version) VALUES
  ('70000000-0000-4000-8000-000000000001', 'outdoor', 'HOAN_KIEM', 'Hồ Hoàn Kiếm và phố đi bộ', 'Đinh Tiên Hoàng, Hoàn Kiếm',
   'Dạo quanh hồ, qua cầu Thê Húc sang đền Ngọc Sơn. Cuối tuần phố đi bộ có nhạc đường phố, trò chơi dân gian.',
   0, NULL, NULL, NULL, 'Phố đi bộ: tối thứ 6 đến hết chủ nhật. Đền Ngọc Sơn có vé riêng.', 90, false, false, '',
   '', 'https://www.google.com/maps/@21.0287,105.8524,16z', 21.0287, 105.8524, '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0),
  ('70000000-0000-4000-8000-000000000002', 'museum', 'HOAN_KIEM', 'Bảo tàng Phụ nữ Việt Nam', '36 Lý Thường Kiệt, Hoàn Kiếm',
   'Bốn tầng trưng bày về phụ nữ Việt: trang phục, trang sức các dân tộc, gia đình, lịch sử. Mát, yên tĩnh, hợp ngày mưa.',
   40000, NULL, '08:00', '17:00', 'Mở cửa hằng ngày. Sinh viên 20.000đ.', 90, true, false, '',
   '', 'https://www.google.com/maps/search/?api=1&query=B%E1%BA%A3o%20t%C3%A0ng%20Ph%E1%BB%A5%20n%E1%BB%AF%20Vi%E1%BB%87t%20Nam%2036%20L%C3%BD%20Th%C6%B0%E1%BB%9Dng%20Ki%E1%BB%87t',
   NULL, NULL, '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0),
  ('70000000-0000-4000-8000-000000000003', 'museum', 'DONG_DA', 'Văn Miếu – Quốc Tử Giám', '58 Quốc Tử Giám, Đống Đa',
   'Trường đại học đầu tiên của Việt Nam: sân vườn cổ, bia tiến sĩ, giếng Thiên Quang. Nhiều góc chụp ảnh áo dài đẹp.',
   70000, NULL, '08:00', '17:00', 'Mùa hè mở 07:30–17:30. Học sinh, sinh viên giảm 50%.', 90, false, false, '',
   '', 'https://www.google.com/maps/@21.0293,105.8355,17z', 21.0293, 105.8355, '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0),
  ('70000000-0000-4000-8000-000000000004', 'show', 'HOAN_KIEM', 'Nhà hát Múa rối nước Thăng Long', '57B Đinh Tiên Hoàng, Hoàn Kiếm',
   'Múa rối nước kèm nhạc dân tộc sống, các tích Chú Tễu, rước kiệu, múa rồng. Ngồi gần sân khấu nên đặt hàng ghế đầu.',
   100000, 200000, NULL, NULL, 'Diễn nhiều suất mỗi ngày, xem lịch và đặt vé: 024 3824 9494.', 50, true, true, '',
   '', 'https://www.google.com/maps/search/?api=1&query=Nh%C3%A0%20h%C3%A1t%20M%C3%BAa%20r%E1%BB%91i%20n%C6%B0%E1%BB%9Bc%20Th%C4%83ng%20Long%2057B%20%C4%90inh%20Ti%C3%AAn%20Ho%C3%A0ng',
   NULL, NULL, '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0),
  ('70000000-0000-4000-8000-000000000005', 'workshop', 'HOAN_KIEM', 'Bày Concept Décor', '2 Nguyễn Dã Tượng, Trần Hưng Đạo, Hoàn Kiếm',
   'Workshop làm nến thơm: tự chọn mùi, màu sáp, cốc đựng rồi mang về. Có buổi riêng cho cặp đôi.',
   250000, 350000, '09:00', '18:30', 'Nên đặt trước, lớp hay kín. Điện thoại: 0848 500 505.', 120, true, true, '',
   '', 'https://www.google.com/maps/search/?api=1&query=B%C3%A0y%20Concept%20D%C3%A9cor%202%20Nguy%E1%BB%85n%20D%C3%A3%20T%C6%B0%E1%BB%A3ng',
   NULL, NULL, '2026-01-01 00:00:00', '2026-01-01 00:00:00', 0);

-- Nhãn kiểu hẹn mặc định (V15): chỉ dòng chưa có ai gán (vibes_source = default)
UPDATE date_spots SET vibes = default_spot_vibes(category) WHERE vibes_source = 'default';

-- Ảnh của chỗ chơi (V17): ảnh bìa thành ảnh số 0
INSERT INTO spot_photos (spot_id, position, url)
SELECT s.id, 0, s.image_url FROM date_spots s
WHERE s.image_url <> '' AND NOT EXISTS (SELECT 1 FROM spot_photos p WHERE p.spot_id = s.id);
