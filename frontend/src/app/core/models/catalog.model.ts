import { Place, PlaceType } from './place.model';

/**
 * Một quán trong "Khám phá quán" (admin nhập): đủ thông tin như một quán trong My place, thêm khu vực.
 * `inMyPlace`: người đang xem đã add quán này vào My place chưa.
 */
export interface CatalogItem extends Omit<Place, 'district'> {
  district: string;
  districtLabel: string;
  inMyPlace: boolean;
}

export interface CatalogPage {
  items: CatalogItem[];
  total: number;
  page: number;
  size: number;
}

export interface DistrictOption {
  code: string;
  label: string;
}

/** Nhóm trong My place của từng loại quán, dùng trong thông báo "Đã được add vào …". */
export const MY_PLACE_GROUP: Record<PlaceType, string> = {
  cafe: 'Quán cafe',
  bar: 'Quán bar',
  restaurant: 'Quán ăn',
};
