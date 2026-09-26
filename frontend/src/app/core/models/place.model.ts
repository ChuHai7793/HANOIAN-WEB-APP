export type PlaceType = 'cafe' | 'restaurant' | 'bar';

export const PLACE_ICONS: Record<PlaceType, string> = {
  cafe: '☕',
  restaurant: '🍜',
  bar: '🍸',
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
