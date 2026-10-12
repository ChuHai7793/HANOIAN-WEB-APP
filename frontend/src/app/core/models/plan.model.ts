import type { IconName } from '../../shared/ui/icon.component';
import { Vibe } from './vibe.model';

export type PlanStatus = 'draft' | 'scheduled' | 'done';
export type StopKind = 'place' | 'spot';
export type PlanSlot = 'afternoon' | 'evening' | 'day';

/**
 * Cảnh báo của một điểm: đóng cửa lúc tới, đóng trước lúc rời, xa điểm trước (> 3km), cùng loại với điểm
 * trước, cần đặt trước, ngoài trời mà plan chọn trời mưa.
 */
export type StopWarning = 'CLOSED' | 'CLOSES_EARLY' | 'FAR' | 'SAME_TYPE' | 'NEEDS_BOOKING' | 'OUTDOOR_RAIN';

export interface PlanStop {
  id: string;
  position: number;
  kind: StopKind;
  /** id quán (Khám phá quán) hoặc id chỗ chơi */
  refId: string;
  /** cafe / bar / restaurant, hoặc nhóm chỗ chơi */
  category: string;
  name: string;
  address: string;
  district: string;
  districtLabel: string;
  imageUrl: string;
  lat: number | null;
  lng: number | null;
  openTime: string | null;
  closeTime: string | null;
  indoor: boolean;
  vibes: Vibe[];
  googleMapsUrl: string;
  durationMin: number;
  note: string;
  rating: number | null;
  memory: string;
  /** "HH:mm" */
  arrival: string;
  departure: string;
  distanceFromPrevM: number | null;
  travelFromPrevMin: number | null;
  travelMode: 'walk' | 'ride' | null;
  warnings: StopWarning[];
}

export interface Plan {
  id: string;
  title: string;
  /** "yyyy-MM-dd", null = chưa chọn ngày */
  date: string | null;
  startTime: string;
  endTime: string;
  district: string | null;
  districtLabel: string | null;
  note: string;
  status: PlanStatus;
  memory: string;
  vibe: Vibe | null;
  budget: number | null;
  rainy: boolean;
  /** false: plan người khác rủ mình đi (chỉ xem) */
  mine: boolean;
  ownerName: string;
  totalDistanceM: number;
  stops: PlanStop[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlanSummary {
  id: string;
  title: string;
  date: string | null;
  startTime: string;
  districtLabel: string | null;
  status: PlanStatus;
  stopCount: number;
  stopNames: string[];
  imageUrl: string | null;
  updatedAt: string;
}

export interface PlanRequest {
  title: string;
  date: string | null;
  startTime: string;
  district: string | null;
  note: string;
  status?: PlanStatus;
  memory?: string;
  vibe: Vibe | null;
  budget: number | null;
  rainy: boolean;
  version?: number;
}

export interface AutoplanRequest {
  district: string;
  date: string | null;
  slot: PlanSlot;
  vibe: Vibe | null;
  budget: number | null;
  rainy: boolean;
}

export const PLAN_STATUSES: { value: PlanStatus; label: string; classes: string }[] = [
  { value: 'draft', label: 'Nháp', classes: 'bg-slate-100 text-slate-600' },
  { value: 'scheduled', label: 'Đã lên lịch', classes: 'bg-brand-50 text-brand-700' },
  { value: 'done', label: 'Đã đi', classes: 'bg-emerald-50 text-emerald-700' },
];

export const PLAN_SLOTS: { value: PlanSlot; label: string; hint: string }[] = [
  { value: 'evening', label: 'Buổi tối', hint: 'Từ 18:00' },
  { value: 'afternoon', label: 'Buổi chiều', hint: 'Từ 14:00' },
  { value: 'day', label: 'Cả ngày', hint: 'Từ 9:00' },
];

/** Ngân sách mỗi điểm (VNĐ / người) cho Autoplan */
export const PLAN_BUDGETS: { value: number | null; label: string }[] = [
  { value: null, label: 'Không giới hạn' },
  { value: 100_000, label: 'Dưới 100k / điểm' },
  { value: 250_000, label: 'Dưới 250k / điểm' },
  { value: 500_000, label: 'Dưới 500k / điểm' },
];

export const STOP_WARNINGS: Record<StopWarning, { label: string; tone: 'danger' | 'warn' | 'info' }> = {
  CLOSED: { label: 'Đóng cửa lúc tới', tone: 'danger' },
  CLOSES_EARLY: { label: 'Đóng cửa trước khi rời', tone: 'warn' },
  FAR: { label: 'Xa điểm trước (> 3km)', tone: 'warn' },
  SAME_TYPE: { label: 'Cùng loại với điểm trước', tone: 'info' },
  NEEDS_BOOKING: { label: 'Nên đặt trước', tone: 'info' },
  OUTDOOR_RAIN: { label: 'Ngoài trời, trời mưa', tone: 'warn' },
};

export function planStatusMeta(status: PlanStatus) {
  return PLAN_STATUSES.find((s) => s.value === status) ?? PLAN_STATUSES[0];
}

const PLACE_ICONS: Record<string, IconName> = { cafe: 'cup', bar: 'cocktail', restaurant: 'utensils' };
const SPOT_ICONS: Record<string, IconName> = {
  entertainment: 'mic',
  workshop: 'palette',
  museum: 'landmark',
  outdoor: 'tree',
  show: 'ticket',
  night_market: 'moon',
  sport: 'activity',
};
const CATEGORY_LABELS: Record<string, string> = {
  cafe: 'Cafe',
  bar: 'Bar',
  restaurant: 'Quán ăn',
  entertainment: 'Giải trí',
  workshop: 'Workshop',
  museum: 'Bảo tàng',
  outdoor: 'Ngoài trời',
  show: 'Biểu diễn',
  night_market: 'Chợ đêm',
  sport: 'Vận động',
};

export function stopIcon(category: string): IconName {
  return PLACE_ICONS[category] ?? SPOT_ICONS[category] ?? 'pin';
}

export function stopCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

/** "650 m" / "2,4 km" */
export function distanceText(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

/** Link chỉ đường Google Maps qua các điểm có toạ độ (điểm đầu → … → điểm cuối). */
export function directionsUrl(stops: PlanStop[]): string | null {
  const pts = stops.filter((s) => s.lat !== null && s.lng !== null).map((s) => `${s.lat},${s.lng}`);
  if (pts.length < 2) return null;
  const params = new URLSearchParams({ api: '1', origin: pts[0], destination: pts[pts.length - 1] });
  if (pts.length > 2) params.set('waypoints', pts.slice(1, -1).join('|'));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
