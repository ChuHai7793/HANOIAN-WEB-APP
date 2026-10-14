export type ReviewTarget = 'place' | 'spot';
export type ReviewSort = 'helpful' | 'newest' | 'high' | 'low';
export type Companion = 'lover' | 'friends' | 'solo' | 'family';

export const COMPANIONS: { value: Companion; label: string }[] = [
  { value: 'lover', label: 'Người yêu' },
  { value: 'friends', label: 'Bạn bè' },
  { value: 'family', label: 'Gia đình' },
  { value: 'solo', label: 'Một mình' },
];

export const REVIEW_SORTS: { value: ReviewSort; label: string }[] = [
  { value: 'helpful', label: 'Hữu ích nhất' },
  { value: 'newest', label: 'Mới nhất' },
  { value: 'high', label: 'Sao cao' },
  { value: 'low', label: 'Sao thấp' },
];

export interface Review {
  id: string;
  author: { id: string; displayName: string; avatarUrl: string | null };
  rating: number;
  body: string;
  companion: Companion | null;
  helpfulCount: number;
  helpedByMe: boolean;
  mine: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewSummary {
  /** null khi chưa có đánh giá */
  average: number | null;
  count: number;
  /** Số đánh giá theo mức sao: [1★, 2★, 3★, 4★, 5★] */
  histogram: number[];
}

export interface ReviewPage {
  summary: ReviewSummary;
  /** Đánh giá của người đang xem (null: chưa viết / khách) */
  mine: Review | null;
  /** Đánh giá của người khác */
  items: Review[];
  total: number;
  page: number;
  size: number;
}

export interface ReviewRequest {
  rating: number;
  body: string;
  companion: Companion | null;
}

/** "4,6" (dấu phẩy kiểu Việt) */
export function ratingText(avg: number): string {
  return avg.toFixed(1).replace('.', ',');
}

/** "2 ngày trước", "vừa xong"… */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'vừa xong';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} phút trước`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} ngày trước`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo} tháng trước`;
  return `${Math.round(mo / 12)} năm trước`;
}
