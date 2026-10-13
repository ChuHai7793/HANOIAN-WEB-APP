import type { IconName } from '../../shared/ui/icon.component';

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

export function priceLabel(value: PriceRange): string {
  return PRICE_RANGES.find((p) => p.value === value)?.label ?? value;
}

/** Ảnh để xem: danh sách ảnh nếu có, không thì ảnh bìa. */
export function photosOf(item: { photos?: string[] | null; imageUrl: string }): string[] {
  return item.photos?.length ? item.photos : item.imageUrl ? [item.imageUrl] : [];
}
