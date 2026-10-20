import {
  EMPTY_PLACE_FILTERS,
  EMPTY_SPOT_FILTERS,
  isOpenAt,
  placeFilterChips,
  placeFilterCount,
  placeFiltersFromParams,
  placeFiltersToParams,
  placeMatches,
  removePlaceFilter,
  spotFilterChips,
  spotFiltersFromParams,
  spotFiltersToParams,
  toggleIn,
} from './filters.model';
import { Place } from './place.model';

const place = (over: Partial<Place>): Place =>
  ({
    id: '1', type: 'restaurant', name: 'Q', address: '', priceRange: 'medium', rating: 4, openTime: '10:00', closeTime: '22:00',
    imageUrl: '', note: '', googleMapsUrl: '', lat: null, lng: null, version: 0, createdAt: '', updatedAt: '', ...over,
  }) as Place;

describe('filters.model', () => {
  it('chip và số bộ lọc (không tính sắp xếp), bỏ từng chip', () => {
    const f = { ...EMPTY_PLACE_FILTERS, priceMin: 100_000, priceMax: 400_000, cuisines: ['Món Nhật'], sort: 'rating' as const };
    expect(placeFilterChips(f).map((c) => c.label)).toEqual(['100k–400k/người', 'Món Nhật', 'Xếp: Sao cao nhất']);
    expect(placeFilterChips({ ...f, priceMax: null })[0].label).toBe('Từ 100k/người');
    expect(placeFilterChips({ ...f, priceMin: null })[0].label).toBe('Đến 400k/người');
    expect(placeFilterCount(f)).toBe(2);
    expect(removePlaceFilter(f, 'price')).toMatchObject({ priceMin: null, priceMax: null });
    expect(removePlaceFilter(f, 'cuisine:Món Nhật').cuisines).toEqual([]);
    expect(removePlaceFilter({ ...EMPTY_PLACE_FILTERS, openNow: true }, 'openNow').openNow).toBe(false);
  });

  it('ghi lên đường dẫn rồi đọc lại được, bỏ giá trị lạ', () => {
    const f = { ...EMPTY_PLACE_FILTERS, priceMin: 150_000, priceMax: 400_000, stars: 4, vibes: ['romantic' as const], openNow: true, sort: 'price' as const };
    const params = placeFiltersToParams(f);
    const back = placeFiltersFromParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v === null ? null : String(v)])));
    expect(back).toEqual(f);
    expect(placeFiltersFromParams({ tu: 'abc', den: '50000', sao: 'x', kieu: 'nope' })).toEqual({ ...EMPTY_PLACE_FILTERS, priceMax: 50_000 });
    const s = { ...EMPTY_SPOT_FILTERS, budget: 0, duration: 'medium' as const, rainy: true };
    expect(spotFiltersFromParams(Object.fromEntries(Object.entries(spotFiltersToParams(s)).map(([k, v]) => [k, v === null ? null : String(v)])))).toEqual(s);
    expect(spotFilterChips(s).map((c) => c.label)).toEqual(['Miễn phí', 'Ngày mưa (trong nhà)', '1–2 giờ']);
  });

  it('đang mở cửa, kể cả qua nửa đêm', () => {
    expect(isOpenAt('10:00', '22:00', '21:59')).toBe(true);
    expect(isOpenAt('10:00', '22:00', '22:00')).toBe(false);
    expect(isOpenAt('18:00', '02:00', '23:30')).toBe(true);
    expect(isOpenAt('18:00', '02:00', '01:00')).toBe(true);
    expect(isOpenAt('18:00', '02:00', '12:00')).toBe(false);
    expect(isOpenAt(null, null, '03:00')).toBe(true);
  });

  it('lọc tại chỗ (My place): khoảng giá giao với khoảng chọn, chưa nhập giá thì bị loại', () => {
    expect(placeMatches(place({ priceFrom: 80_000, priceTo: 120_000 }), { ...EMPTY_PLACE_FILTERS, priceMax: 50_000 })).toBe(false);
    expect(placeMatches(place({ priceFrom: 80_000, priceTo: 120_000 }), { ...EMPTY_PLACE_FILTERS, priceMin: 100_000, priceMax: 400_000 })).toBe(true);
    expect(placeMatches(place({ priceFrom: 80_000 }), { ...EMPTY_PLACE_FILTERS, priceMin: 100_000 })).toBe(false);
    expect(placeMatches(place({}), { ...EMPTY_PLACE_FILTERS, priceMin: 0 })).toBe(false);
    expect(placeMatches(place({}), EMPTY_PLACE_FILTERS)).toBe(true);
    expect(placeMatches(place({ rating: 3 }), { ...EMPTY_PLACE_FILTERS, stars: 4 })).toBe(false);
    expect(placeMatches(place({ cuisine: 'Món Việt' }), { ...EMPTY_PLACE_FILTERS, cuisines: ['Món Nhật'] })).toBe(false);
    expect(placeMatches(place({}), { ...EMPTY_PLACE_FILTERS, openNow: true }, '23:00')).toBe(false);
    expect(toggleIn(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleIn(['a', 'b'], 'a')).toEqual(['b']);
  });
});
