import { Place, PlaceType } from './place.model';
import { Vibe, VibeSource } from './vibe.model';

/**
 * Một quán trong "Khám phá quán" (admin nhập): đủ thông tin như một quán trong My place, thêm khu vực.
 * `inMyPlace`: người đang xem đã add quán này vào My place chưa. `fans`: số "người hợp gu đã lưu" (null
 * khi mình chưa bật Tìm đối tượng).
 */
export interface CatalogItem extends Omit<Place, 'district'> {
  district: string;
  districtLabel: string;
  inMyPlace: boolean;
  fans: number | null;
  /** Đường dẫn trang riêng: /quan/{slug} */
  slug: string;
  /** Điểm đánh giá trung bình của người dùng (null = chưa có) và số đánh giá */
  ratingAvg: number | null;
  ratingCount: number;
  /** Kiểu hẹn phù hợp (Autoplan) và nguồn nhãn */
  vibes: Vibe[];
  vibesSource: VibeSource;
}

/** Số quán theo loại cho chip lọc; `all` là tổng. */
export type TypeCounts = Record<'all' | PlaceType, number>;

export interface CatalogPage {
  items: CatalogItem[];
  total: number;
  page: number;
  size: number;
}

export interface DistrictOption {
  code: string;
  label: string;
  /** Số quán trong Khám phá quán ở khu vực này */
  count: number;
}

/** Nhóm trong My place của từng loại quán, dùng trong thông báo "Đã được add vào …". */
export const MY_PLACE_GROUP: Record<PlaceType, string> = {
  cafe: 'Quán cafe',
  bar: 'Quán bar',
  restaurant: 'Quán ăn',
};

/** "Điểm hẹn nổi bật" do admin chọn (tối đa 3): vị trí 1 là thẻ lớn */
export interface FeaturedItem {
  position: number;
  /** Dòng nhỏ phía trên, vd. "Một chút bình yên" */
  kicker: string;
  /** Câu dẫn lớn, xuống dòng bằng \n */
  headline: string;
  place: CatalogItem;
}

export interface FeaturedRequest {
  catalogId: string;
  kicker: string;
  headline: string;
}
