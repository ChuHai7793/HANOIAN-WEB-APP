import { placePriceDetail, placePriceText, priceRangeFor } from './place.model';

describe('place.model: giá', () => {
  it('chưa có giá cụ thể thì hiện nhóm giá', () => {
    expect(placePriceText({ priceFrom: null, priceTo: null })).toBe('');
    expect(placePriceText({})).toBe('');
    expect(placePriceDetail({})).toBe('Chưa có giá');
  });

  it('có giá cụ thể: khoảng, hoặc "Từ" khi chỉ có giá bắt đầu', () => {
    expect(placePriceText({ priceFrom: 80_000, priceTo: 150_000 })).toBe('80k–150k/người');
    expect(placePriceText({ priceFrom: 80_000, priceTo: 150_000 }, false)).toBe('80k–150k');
    expect(placePriceText({ priceFrom: 1_200_000, priceTo: null })).toBe('Từ 1,2tr/người');
    expect(placePriceDetail({ priceFrom: 80_000, priceTo: 150_000 })).toBe('80k–150k/người');
  });

  it('tự chọn nhóm giá theo giữa khoảng', () => {
    expect(priceRangeFor(30_000, 60_000)).toBe('cheap');
    expect(priceRangeFor(80_000, 150_000)).toBe('medium');
    expect(priceRangeFor(150_000, null)).toBe('high');
    expect(priceRangeFor(300_000, 600_000)).toBe('luxury');
  });
});
