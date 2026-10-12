import type { IconName } from '../../shared/ui/icon.component';
import { PlaceType, PriceRange } from './place.model';
import { SpotCategory } from './spot.model';

/** Kiểu hẹn một quán / chỗ chơi hợp (dùng cho Autoplan). */
export type Vibe = 'chill' | 'active' | 'romantic';

/** Nhãn từ đâu: suy ra theo loại < Claude gán từ mô tả < admin chọn tay (không gì tự ghi đè). */
export type VibeSource = 'default' | 'claude' | 'admin';

export const VIBES: { value: Vibe; icon: IconName; label: string }[] = [
  { value: 'chill', icon: 'leaf', label: 'Chill' },
  { value: 'active', icon: 'zap', label: 'Năng động' },
  { value: 'romantic', icon: 'heart', label: 'Lãng mạn' },
];

/** Lựa chọn trong form admin. `auto`: để hệ thống tự gán theo loại (gửi `vibesAuto: true`). */
export interface VibeChoice {
  vibes: Vibe[];
  auto: boolean;
}

export function vibeMeta(value: Vibe): { icon: IconName; label: string } {
  return VIBES.find((v) => v.value === value) ?? { icon: 'heart', label: value };
}

/** Giữ thứ tự chill, active, romantic như server trả về. */
export function sortVibes(vibes: Vibe[]): Vibe[] {
  return VIBES.map((v) => v.value).filter((v) => vibes.includes(v));
}

// Nhãn mặc định theo loại: giống VibeDefaults (backend) và hàm SQL của V15. Chỉ để form hiện trước nhãn
// sẽ được gán; giá trị thật do server quyết định.

export function defaultPlaceVibes(type: PlaceType, price: PriceRange | null | undefined): Vibe[] {
  if (type === 'cafe') return ['chill'];
  if (type === 'bar') return ['romantic'];
  return price === 'high' || price === 'luxury' ? ['romantic'] : ['chill', 'romantic'];
}

export function defaultSpotVibes(category: SpotCategory): Vibe[] {
  switch (category) {
    case 'entertainment':
    case 'night_market':
    case 'sport':
      return ['active'];
    case 'workshop':
    case 'show':
      return ['romantic'];
    case 'museum':
      return ['chill'];
    case 'outdoor':
      return ['chill', 'romantic'];
  }
}
