import { placePriceDetail, placePriceText, priceRangeFor } from './place.model';

describe('place.model: giá', () => {
  it('chưa có giá cụ thể thì hiện nhóm giá', () => {
    expect(placePriceText({ priceRange: 'medium', priceFrom: null, priceTo: null })).toBe('Tầm trung');
    expect(placePriceText({ priceRange: 'cheap' })).toBe('Bình dân');
    expect(placePriceDetail({ priceRange: 'high' })).toBe('Hơi sang');
  });

  it('có giá cụ thể: khoảng, hoặc "Từ" khi chỉ có giá bắt đầu', () => {
    expect(placePriceText({ priceRange: 'medium', priceFrom: 80_000, priceTo: 150_000 })).toBe('80k–150k/người');
    expect(placePriceText({ priceRange: 'medium', priceFrom: 80_000, priceTo: 150_000 }, false)).toBe('80k–150k');
    expect(placePriceText({ priceRange: 'luxury', priceFrom: 1_200_000, priceTo: null })).toBe('Từ 1,2tr/người');
    expect(placePriceDetail({ priceRange: 'medium', priceFrom: 80_000, priceTo: 150_000 })).toBe('80k–150k/người · Tầm trung');
  });

  it('tự chọn nhóm giá theo giữa khoảng', () => {
    expect(priceRangeFor(30_000, 60_000)).toBe('cheap');
    expect(priceRangeFor(80_000, 150_000)).toBe('medium');
    expect(priceRangeFor(150_000, null)).toBe('high');
    expect(priceRangeFor(300_000, 600_000)).toBe('luxury');
  });
});
