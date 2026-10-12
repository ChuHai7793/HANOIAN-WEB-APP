import { PlaceType } from '../../core/models/place.model';
import { IconName } from '../../shared/ui/icon.component';

/** Cấu hình riêng của từng loại quán — phần duy nhất khác nhau giữa màn Cafe và màn Quán ăn */
export interface PlaceTypeConfig {
  type: PlaceType;
  icon: IconName;
  title: string;
  subtitle: string;
  addLabel: string;
  searchPlaceholder: string;
  emptyTitle: string;
  emptyDescription: string;
  /** Cafe hiện wifi / chỗ đậu xe, quán ăn hiện loại món */
  showAmenities: boolean;
  showCuisine: boolean;
}

export const CAFE_CONFIG: PlaceTypeConfig = {
  type: 'cafe',
  icon: 'cup',
  title: 'Quán cafe',
  subtitle: 'My place · Quán cafe đã lưu từ Khám phá quán',
  addLabel: 'Thêm quán cafe',
  searchPlaceholder: 'Tìm theo tên, địa chỉ, ghi chú…',
  emptyTitle: 'Chưa có quán cafe nào',
  emptyDescription: 'Vào Khám phá quán, bấm "Add vào My place" để lưu quán vào đây.',
  showAmenities: true,
  showCuisine: false,
};

export const BAR_CONFIG: PlaceTypeConfig = {
  type: 'bar',
  icon: 'cocktail',
  title: 'Quán bar',
  subtitle: 'My place · Quán bar đã lưu từ Khám phá quán',
  addLabel: 'Thêm quán bar',
  searchPlaceholder: 'Tìm theo tên, địa chỉ, ghi chú…',
  emptyTitle: 'Chưa có quán bar nào',
  emptyDescription: 'Vào Khám phá quán, bấm "Add vào My place" để lưu quán vào đây.',
  showAmenities: true,
  showCuisine: false,
};

export const RESTAURANT_CONFIG: PlaceTypeConfig = {
  type: 'restaurant',
  icon: 'utensils',
  title: 'Quán ăn',
  subtitle: 'My place · Quán ăn đã lưu từ Khám phá quán',
  addLabel: 'Thêm quán ăn',
  searchPlaceholder: 'Tìm theo tên, địa chỉ, loại món…',
  emptyTitle: 'Chưa có quán ăn nào',
  emptyDescription: 'Vào Khám phá quán, bấm "Add vào My place" để lưu quán vào đây.',
  showAmenities: false,
  showCuisine: true,
};
