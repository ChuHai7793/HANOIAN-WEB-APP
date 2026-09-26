import { PlaceType } from './place.model';

/** Liên kết giữa một người yêu và một quán đã đi cùng */
export interface PlaceLink {
  id: string;
  girlfriendId: string;
  placeId: string;
  placeType: PlaceType;
  herRating: number; // nàng chấm 1..5
  lastVisitedAt: string; // 'yyyy-MM-dd'
  memory: string; // kỷ niệm
  version: number;
  createdAt: string;
}
