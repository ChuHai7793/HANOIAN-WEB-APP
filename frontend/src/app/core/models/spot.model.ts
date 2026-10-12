import type { IconName } from '../../shared/ui/icon.component';
import type { Vibe, VibeSource } from './vibe.model';

export type SpotCategory =
  | 'entertainment'
  | 'workshop'
  | 'museum'
  | 'outdoor'
  | 'show'
  | 'night_market'
  | 'sport';

export const SPOT_CATEGORIES: { value: SpotCategory; icon: IconName; label: string }[] = [
  { value: 'entertainment', icon: 'mic', label: 'Giải trí trong nhà' },
  { value: 'workshop', icon: 'palette', label: 'Workshop' },
  { value: 'museum', icon: 'landmark', label: 'Bảo tàng, di tích' },
  { value: 'outdoor', icon: 'tree', label: 'Dạo chơi ngoài trời' },
  { value: 'show', icon: 'ticket', label: 'Biểu diễn' },
  { value: 'night_market', icon: 'moon', label: 'Chợ đêm, phố đêm' },
  { value: 'sport', icon: 'activity', label: 'Vận động' },
];

/**
 * Một chỗ chơi trong "Tìm chỗ chơi" (admin nhập). Giá theo VNĐ/người: `priceFrom` 0 = miễn phí,
 * `priceTo` null = một mức giá. `openTime`/`closeTime` cùng null = không có giờ cố định.
 */
export interface SpotItem {
  id: string;
  category: SpotCategory;
  district: string;
  districtLabel: string;
  name: string;
  address: string;
  description: string;
  priceFrom: number;
  priceTo: number | null;
  openTime: string | null;
  closeTime: string | null;
  hoursNote: string;
  durationMin: number | null;
  indoor: boolean;
  needsBooking: boolean;
  bookingUrl: string;
  imageUrl: string;
  googleMapsUrl: string;
  lat: number | null;
  lng: number | null;
  /** Kiểu hẹn phù hợp (Autoplan) và nguồn nhãn */
  vibes: Vibe[];
  vibesSource: VibeSource;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SpotPage {
  items: SpotItem[];
  total: number;
  page: number;
  size: number;
}

export function spotCategory(value: SpotCategory): { icon: IconName; label: string } {
  return SPOT_CATEGORIES.find((c) => c.value === value) ?? { icon: 'pin', label: value };
}

/** 150000 → "150k", 1200000 → "1,2tr" */
function shortVnd(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}tr`;
  if (value >= 1000) return `${(value / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}k`;
  return `${value}đ`;
}

/** "Miễn phí", "40k/người", "150k–300k/người", "Đến 50k/người" */
export function spotPriceText(spot: Pick<SpotItem, 'priceFrom' | 'priceTo'>): string {
  if (spot.priceFrom === 0 && !spot.priceTo) return 'Miễn phí';
  if (!spot.priceTo) return `${shortVnd(spot.priceFrom)}/người`;
  if (spot.priceFrom === 0) return `Đến ${shortVnd(spot.priceTo)}/người`;
  return `${shortVnd(spot.priceFrom)}–${shortVnd(spot.priceTo)}/người`;
}

/** 90 → "1h30", 120 → "2h", 50 → "50 phút" */
export function durationText(min: number): string {
  if (min < 60) return `${min} phút`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}
