import type { IconName } from '../../shared/ui/icon.component';
import type { Vibe, VibeSource } from './vibe.model';
import { shortVnd } from '../utils/money';

export type SpotCategory =
  | 'entertainment'
  | 'workshop'
  | 'museum'
  | 'outdoor'
  | 'show'
  | 'night_market'
  | 'sport';

/** `short`: tên trên chip lọc (gọn để các chip vừa một dòng); `label`: tên đầy đủ ở thẻ, popup, form. */
export const SPOT_CATEGORIES: { value: SpotCategory; icon: IconName; label: string; short: string }[] = [
  { value: 'entertainment', icon: 'mic', label: 'Giải trí trong nhà', short: 'Giải trí' },
  { value: 'workshop', icon: 'palette', label: 'Workshop', short: 'Workshop' },
  { value: 'museum', icon: 'landmark', label: 'Bảo tàng, di tích', short: 'Bảo tàng' },
  { value: 'outdoor', icon: 'tree', label: 'Dạo chơi ngoài trời', short: 'Ngoài trời' },
  { value: 'show', icon: 'ticket', label: 'Biểu diễn', short: 'Biểu diễn' },
  { value: 'night_market', icon: 'moon', label: 'Chợ đêm, phố đêm', short: 'Chợ đêm' },
  { value: 'sport', icon: 'activity', label: 'Vận động', short: 'Vận động' },
];

/**
 * Một chỗ chơi trong "Tìm chỗ chơi" (admin nhập). Giá theo VNĐ/người: `priceFrom` 0 = miễn phí,
 * `priceTo` null = một mức giá. `openTime`/`closeTime` cùng null = không có giờ cố định.
 */
export interface SpotItem {
  id: string;
  category: SpotCategory;
  /** Đường dẫn trang riêng: /cho-choi/{slug} */
  slug: string;
  /** Nhóm khác ngoài nhóm chính: lọc theo nhóm khớp cả các nhóm này */
  extraCategories: SpotCategory[];
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
  /** Mọi ảnh (tối đa 6); ảnh đầu = imageUrl */
  photos: string[];
  /** Người đang xem đã lưu vào My place chưa */
  inMyPlace: boolean;
  /** Điểm đánh giá trung bình của người dùng (null = chưa có) và số đánh giá */
  ratingAvg: number | null;
  ratingCount: number;
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

/** "Chỗ chơi nổi bật" do admin chọn (tối đa 6), ở đầu Tìm chỗ chơi */
export interface FeaturedSpot {
  position: number;
  /** Dòng nhỏ phía trên, vd. "Cùng làm một thứ" */
  kicker: string;
  /** Câu dẫn lớn, xuống dòng bằng 
 */
  headline: string;
  spot: SpotItem;
}

export interface FeaturedSpotRequest {
  spotId: string;
  kicker: string;
  headline: string;
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
