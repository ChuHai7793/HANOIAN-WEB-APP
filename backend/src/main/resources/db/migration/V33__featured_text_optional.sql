-- V33: Thẻ nổi bật đặt tên quán / chỗ chơi làm chính, câu dẫn và dòng nhỏ chỉ là phụ chú không bắt buộc.
-- Câu dẫn có thể rỗng (mặc định ''), và xoá sạch câu mẫu đã điền sẵn trước đây để admin tự viết nếu muốn.
ALTER TABLE featured_places ALTER COLUMN headline SET DEFAULT '';
ALTER TABLE featured_spots ALTER COLUMN headline SET DEFAULT '';
UPDATE featured_places SET kicker = '', headline = '';
UPDATE featured_spots SET kicker = '', headline = '';
