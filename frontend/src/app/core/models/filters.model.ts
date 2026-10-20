import type { Params } from '@angular/router';
import type { IconName } from '../../shared/ui/icon.component';
import { CUISINES, Place } from './place.model';
import { shortVnd } from '../utils/money';
import { Vibe, VIBES } from './vibe.model';

/** Một lựa chọn trong nhóm chip của bảng lọc */
export interface ChoiceOption<T extends string | number = string | number> {
  value: T;
  label: string;
  icon?: IconName;
}

/** Một bộ lọc đang bật, hiện thành chip có dấu ✕ trên danh sách */
export interface ActiveFilter {
  key: string;
  label: string;
}

// ---------------------------------------------------------------- Quán (Khám phá quán, My place)

export type PlaceSort = '' | 'rating' | 'price' | 'newest';

export interface PlaceFilters {
  /** Giá mỗi người (VNĐ) từ mức này; null = không giới hạn. Quán chưa nhập giá bị loại khi lọc theo tiền. */
  priceMin: number | null;
  /** Giá mỗi người (VNĐ) đến mức này; null = không giới hạn */
  priceMax: number | null;
  /** HANOIVIBE chấm từ mức này trở lên */
  stars: number | null;
  cuisines: string[];
  vibes: Vibe[];
  openNow: boolean;
  wifi: boolean;
  parking: boolean;
  sort: PlaceSort;
}

export const EMPTY_PLACE_FILTERS: PlaceFilters = {
  priceMin: null,
  priceMax: null,
  stars: null,
  cuisines: [],
  vibes: [],
  openNow: false,
  wifi: false,
  parking: false,
  sort: '',
};

export const STAR_OPTIONS: ChoiceOption<number>[] = [
  { value: 3, label: 'Từ 3★' },
  { value: 4, label: 'Từ 4★' },
  { value: 5, label: '5★' },
];
export const CUISINE_OPTIONS: ChoiceOption<string>[] = CUISINES.map((c) => ({ value: c, label: c.replace(/^Món /, '') }));
export const VIBE_OPTIONS: ChoiceOption<Vibe>[] = VIBES.map((v) => ({ value: v.value, label: v.label, icon: v.icon }));
export const PLACE_SORTS: ChoiceOption<PlaceSort>[] = [
  { value: '', label: 'Mặc định (A–Z)' },
  { value: 'rating', label: 'Sao cao nhất' },
  { value: 'price', label: 'Giá thấp → cao' },
  { value: 'newest', label: 'Mới thêm' },
];

/** Bật / tắt một giá trị trong danh sách chọn nhiều */
export function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Nhãn khoảng tiền: "100k–400k/người", "Từ 100k/người", "Đến 400k/người"; rỗng khi không giới hạn */
export function priceRangeLabel(min: number | null, max: number | null): string {
  if (min !== null && max !== null) return `${shortVnd(min)}–${shortVnd(max)}/người`;
  if (min !== null) return `Từ ${shortVnd(min)}/người`;
  if (max !== null) return `Đến ${shortVnd(max)}/người`;
  return '';
}

/** Số bộ lọc đang bật (không tính sắp xếp) */
export function placeFilterCount(f: PlaceFilters): number {
  return placeFilterChips(f).filter((c) => c.key !== 'sort').length;
}

export function placeFilterChips(f: PlaceFilters): ActiveFilter[] {
  const out: ActiveFilter[] = [];
  const price = priceRangeLabel(f.priceMin, f.priceMax);
  if (price) out.push({ key: 'price', label: price });
  if (f.stars !== null) out.push({ key: 'stars', label: f.stars === 5 ? '5★' : `Từ ${f.stars}★` });
  for (const c of f.cuisines) out.push({ key: `cuisine:${c}`, label: c });
  for (const v of f.vibes) out.push({ key: `vibe:${v}`, label: VIBES.find((x) => x.value === v)?.label ?? v });
  if (f.openNow) out.push({ key: 'openNow', label: 'Đang mở cửa' });
  if (f.wifi) out.push({ key: 'wifi', label: 'Có wifi' });
  if (f.parking) out.push({ key: 'parking', label: 'Có chỗ đậu xe' });
  if (f.sort) out.push({ key: 'sort', label: `Xếp: ${PLACE_SORTS.find((s) => s.value === f.sort)?.label}` });
  return out;
}

/** Bỏ một bộ lọc theo khoá của chip */
export function removePlaceFilter(f: PlaceFilters, key: string): PlaceFilters {
  const [kind, value] = key.split(/:(.*)/s);
  switch (kind) {
    case 'price':
      return { ...f, priceMin: null, priceMax: null };
    case 'cuisine':
      return { ...f, cuisines: f.cuisines.filter((c) => c !== value) };
    case 'vibe':
      return { ...f, vibes: f.vibes.filter((v) => v !== value) };
    case 'stars':
      return { ...f, stars: null };
    case 'sort':
      return { ...f, sort: '' };
    default:
      return { ...f, [kind]: false };
  }
}

/** Ghi bộ lọc lên đường dẫn (giữ khi bấm Back, gửi link cho người khác thấy đúng danh sách) */
export function placeFiltersToParams(f: PlaceFilters): Params {
  return {
    tu: f.priceMin,
    den: f.priceMax,
    sao: f.stars,
    mon: f.cuisines.length ? f.cuisines.join(',') : null,
    kieu: f.vibes.length ? f.vibes.join(',') : null,
    mo: f.openNow ? 1 : null,
    wifi: f.wifi ? 1 : null,
    doxe: f.parking ? 1 : null,
    xep: f.sort || null,
  };
}

export function placeFiltersFromParams(p: Record<string, string | null>): PlaceFilters {
  const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);
  const num = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : null);
  const vibes = list(p['kieu']).filter((v): v is Vibe => VIBES.some((x) => x.value === v));
  const sort = PLACE_SORTS.find((s) => s.value === p['xep'])?.value ?? '';
  return {
    priceMin: num(p['tu']),
    priceMax: num(p['den']),
    stars: num(p['sao']),
    cuisines: list(p['mon']).filter((c) => CUISINES.includes(c)),
    vibes,
    openNow: p['mo'] === '1',
    wifi: p['wifi'] === '1',
    parking: p['doxe'] === '1',
    sort,
  };
}

/** Giờ hiện tại của máy người xem, dạng "HH:mm" */
export function nowHHmm(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Đang mở lúc t ("HH:mm"), kể cả giờ đóng qua nửa đêm. Không có giờ: tính là đang mở. */
export function isOpenAt(open: string | null, close: string | null, t: string): boolean {
  if (!open || !close) return true;
  const o = open.slice(0, 5);
  const c = close.slice(0, 5);
  return o <= c ? o <= t && t < c : t >= o || t < c;
}

/**
 * Khoảng giá [from, to ?? from] của quán / chỗ chơi có giao với khoảng người dùng chọn không. Không chọn gì thì
 * luôn đúng; chưa nhập giá (from null) thì bị loại khi có lọc theo tiền.
 */
export function priceInRange(from: number | null | undefined, to: number | null | undefined, min: number | null, max: number | null): boolean {
  if (min === null && max === null) return true;
  if (from === null || from === undefined) return false;
  const high = to ?? from;
  if (min !== null && high < min) return false;
  if (max !== null && from > max) return false;
  return true;
}

/** Lọc tại chỗ (My place: dữ liệu đã tải sẵn). Kiểu hẹn không có ở bản trong My place nên bỏ qua. */
export function placeMatches(p: Place, f: PlaceFilters, now = nowHHmm()): boolean {
  if (!priceInRange(p.priceFrom, p.priceTo, f.priceMin, f.priceMax)) return false;
  if (f.stars !== null && p.rating < f.stars) return false;
  if (f.cuisines.length && !f.cuisines.includes(p.cuisine ?? '')) return false;
  if (f.openNow && !isOpenAt(p.openTime, p.closeTime, now)) return false;
  if (f.wifi && !p.hasWifi) return false;
  if (f.parking && !p.hasParking) return false;
  return true;
}

// ---------------------------------------------------------------- Chỗ chơi (Tìm chỗ chơi)

export type SpotDuration = '' | 'short' | 'medium' | 'long';
export type SpotSort = '' | 'price' | 'newest';

export interface SpotFilters {
  /** Giá thấp nhất không quá mức này (0 = chỉ chỗ miễn phí) */
  budget: number | null;
  openNow: boolean;
  /** Ngày mưa: chỉ chỗ trong nhà */
  rainy: boolean;
  duration: SpotDuration;
  noBooking: boolean;
  vibes: Vibe[];
  sort: SpotSort;
}

export const EMPTY_SPOT_FILTERS: SpotFilters = { budget: null, openNow: false, rainy: false, duration: '', noBooking: false, vibes: [], sort: '' };

export const SPOT_BUDGETS: ChoiceOption<number>[] = [
  { value: 0, label: 'Miễn phí' },
  ...[100_000, 200_000, 500_000].map((v) => ({ value: v, label: `Dưới ${shortVnd(v)}` })),
];
export const DURATION_OPTIONS: ChoiceOption<Exclude<SpotDuration, ''>>[] = [
  { value: 'short', label: 'Dưới 1 giờ' },
  { value: 'medium', label: '1–2 giờ' },
  { value: 'long', label: 'Trên 2 giờ' },
];
/** Thời lượng (phút) gửi lên API */
export const DURATION_RANGES: Record<Exclude<SpotDuration, ''>, { minDuration?: number; maxDuration?: number }> = {
  short: { maxDuration: 60 },
  medium: { minDuration: 61, maxDuration: 120 },
  long: { minDuration: 121 },
};
export const SPOT_SORTS: ChoiceOption<SpotSort>[] = [
  { value: '', label: 'Mặc định (A–Z)' },
  { value: 'price', label: 'Giá thấp → cao' },
  { value: 'newest', label: 'Mới thêm' },
];

export function spotFilterCount(f: SpotFilters): number {
  return spotFilterChips(f).filter((c) => c.key !== 'sort').length;
}

export function spotFilterChips(f: SpotFilters): ActiveFilter[] {
  const out: ActiveFilter[] = [];
  if (f.budget !== null) out.push({ key: 'budget', label: f.budget === 0 ? 'Miễn phí' : `Dưới ${shortVnd(f.budget)}/người` });
  if (f.openNow) out.push({ key: 'openNow', label: 'Đang mở cửa' });
  if (f.rainy) out.push({ key: 'rainy', label: 'Ngày mưa (trong nhà)' });
  if (f.duration) out.push({ key: 'duration', label: DURATION_OPTIONS.find((d) => d.value === f.duration)?.label ?? '' });
  if (f.noBooking) out.push({ key: 'noBooking', label: 'Không cần đặt trước' });
  for (const v of f.vibes) out.push({ key: `vibe:${v}`, label: VIBES.find((x) => x.value === v)?.label ?? v });
  if (f.sort) out.push({ key: 'sort', label: `Xếp: ${SPOT_SORTS.find((s) => s.value === f.sort)?.label}` });
  return out;
}

export function removeSpotFilter(f: SpotFilters, key: string): SpotFilters {
  const [kind, value] = key.split(/:(.*)/s);
  switch (kind) {
    case 'vibe':
      return { ...f, vibes: f.vibes.filter((v) => v !== value) };
    case 'budget':
      return { ...f, budget: null };
    case 'duration':
      return { ...f, duration: '' };
    case 'sort':
      return { ...f, sort: '' };
    default:
      return { ...f, [kind]: false };
  }
}

export function spotFiltersToParams(f: SpotFilters): Params {
  return {
    ngansach: f.budget,
    mo: f.openNow ? 1 : null,
    mua: f.rainy ? 1 : null,
    thoiluong: f.duration || null,
    khongdat: f.noBooking ? 1 : null,
    kieu: f.vibes.length ? f.vibes.join(',') : null,
    xep: f.sort || null,
  };
}

export function spotFiltersFromParams(p: Record<string, string | null>): SpotFilters {
  const budget = p['ngansach'] && /^\d+$/.test(p['ngansach']) ? Number(p['ngansach']) : null;
  return {
    budget,
    openNow: p['mo'] === '1',
    rainy: p['mua'] === '1',
    duration: DURATION_OPTIONS.find((d) => d.value === p['thoiluong'])?.value ?? '',
    noBooking: p['khongdat'] === '1',
    vibes: (p['kieu'] ?? '').split(',').filter((v): v is Vibe => VIBES.some((x) => x.value === v)),
    sort: SPOT_SORTS.find((s) => s.value === p['xep'])?.value ?? '',
  };
}
