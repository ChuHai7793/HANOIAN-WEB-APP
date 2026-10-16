import type { IconName } from '../../shared/ui/icon.component';
import { shortVnd } from '../utils/money';

export type PlaceType = 'cafe' | 'restaurant' | 'bar';

export const PLACE_ICONS: Record<PlaceType, IconName> = {
  cafe: 'cup',
  restaurant: 'utensils',
  bar: 'cocktail',
};

export const PLACE_LABELS: Record<PlaceType, string> = {
  cafe: 'quán cafe',
  restaurant: 'quán ăn',
  bar: 'quán bar',
};

/** Khoảng giá trung bình cho 1 người */
export type PriceRange = 'cheap' | 'medium' | 'high' | 'luxury';

export interface Place {
  id: string;
  type: PlaceType;
  name: string;
  address: string;
  priceRange: PriceRange;
  /** Giá cụ thể VNĐ/người; null / vắng = chưa nhập (chỉ có nhóm giá) */
  priceFrom?: number | null;
  /** null = chỉ có giá từ */
  priceTo?: number | null;
  rating: number; // 1..5
  openTime: string; // 'HH:mm'
  closeTime: string; // 'HH:mm'
  imageUrl: string;
  /** Mọi ảnh (quán từ Khám phá quán); ảnh đầu = imageUrl. Có thể thiếu: khi đó chỉ có imageUrl */
  photos?: string[] | null;
  note: string;

  /** Vị trí — lấy từ link Google Maps người dùng dán vào */
  googleMapsUrl: string;
  lat: number | null;
  lng: number | null;

  /** Riêng quán cafe */
  hasWifi?: boolean;
  hasParking?: boolean;

  /** Riêng quán ăn */
  cuisine?: string;

  /** Chỉ dùng trong form của "Khám phá quán": mã quận (khu vực), bắt buộc ở đó */
  district?: string;

  /** Quán gốc trong Khám phá quán (plan tham chiếu quán theo id này); null với quán tự nhập cũ */
  catalogId?: string | null;

  /** Optimistic locking: gửi kèm khi sửa, server tăng sau mỗi lần ghi */
  version: number;
  createdAt: string;
  updatedAt: string;
}

export const PRICE_RANGES: { value: PriceRange; label: string; hint: string }[] = [
  { value: 'cheap', label: 'Bình dân', hint: '< 50k' },
  { value: 'medium', label: 'Tầm trung', hint: '50k – 150k' },
  { value: 'high', label: 'Hơi sang', hint: '150k – 400k' },
  { value: 'luxury', label: 'Sang chảnh', hint: '> 400k' },
];

export const CUISINES: string[] = [
  'Món Việt',
  'Món Nhật',
  'Món Hàn',
  'Món Thái',
  'Món Trung',
  'Món Âu',
  'Lẩu',
  'Nướng BBQ',
  'Hải sản',
  'Chay',
  'Ăn vặt',
];

/**
 * Giá để hiện: có giá cụ thể thì "80k–150k/người" / "Từ 80k/người", chưa có thì tên nhóm giá ("Tầm trung").
 * {@code unit} false: bỏ "/người" (huy hiệu nhỏ trên thẻ).
 */
export function placePriceText(p: Pick<Place, 'priceRange' | 'priceFrom' | 'priceTo'>, unit = true): string {
  if (p.priceFrom === null || p.priceFrom === undefined) return priceLabel(p.priceRange);
  const range = p.priceTo ? `${shortVnd(p.priceFrom)}–${shortVnd(p.priceTo)}` : `Từ ${shortVnd(p.priceFrom)}`;
  return unit ? `${range}/người` : range;
}

/** Ô "Mức giá" ở popup / trang quán: "80k–150k/người · Tầm trung", chưa có giá cụ thể thì "Tầm trung" */
export function placePriceDetail(p: Pick<Place, 'priceRange' | 'priceFrom' | 'priceTo'>): string {
  const label = priceLabel(p.priceRange);
  return p.priceFrom === null || p.priceFrom === undefined ? label : `${placePriceText(p)} · ${label}`;
}

/** Nhóm giá theo giá cụ thể (lấy giữa khoảng), cùng mốc với PRICE_RANGES: <50k, 50–150k, 150–400k, >400k */
export function priceRangeFor(from: number, to: number | null): PriceRange {
  const mid = to ? (from + to) / 2 : from;
  if (mid < 50_000) return 'cheap';
  if (mid < 150_000) return 'medium';
  if (mid < 400_000) return 'high';
  return 'luxury';
}

export function priceLabel(value: PriceRange): string {
  return PRICE_RANGES.find((p) => p.value === value)?.label ?? value;
}

/** Ảnh để xem: danh sách ảnh nếu có, không thì ảnh bìa. */
export function photosOf(item: { photos?: string[] | null; imageUrl: string }): string[] {
  return item.photos?.length ? item.photos : item.imageUrl ? [item.imageUrl] : [];
}
