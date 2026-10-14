import { ratingText, timeAgo } from './review.model';

describe('review.model', () => {
  it('điểm dùng dấu phẩy, 1 chữ số thập phân', () => {
    expect(ratingText(4.6)).toBe('4,6');
    expect(ratingText(5)).toBe('5,0');
  });

  it('thời gian tương đối', () => {
    const now = Date.parse('2026-10-14T12:00:00Z');
    expect(timeAgo('2026-10-14T11:59:30Z', now)).toBe('vừa xong');
    expect(timeAgo('2026-10-14T11:15:00Z', now)).toBe('45 phút trước');
    expect(timeAgo('2026-10-14T07:00:00Z', now)).toBe('5 giờ trước');
    expect(timeAgo('2026-10-12T12:00:00Z', now)).toBe('2 ngày trước');
    expect(timeAgo('2026-07-14T12:00:00Z', now)).toBe('3 tháng trước');
    expect(timeAgo('2024-10-14T12:00:00Z', now)).toBe('2 năm trước');
  });
});
