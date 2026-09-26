import { PlaceType } from '../../core/models/place.model';

/** Cấu hình riêng của từng loại quán — phần duy nhất khác nhau giữa màn Cafe và màn Quán ăn */
export interface PlaceTypeConfig {
  type: PlaceType;
  icon: string;
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
  icon: '☕',
  title: 'Quán cafe',
  subtitle: 'Những chỗ ngồi đẹp để hẹn hò hoặc ngồi lâu',
  addLabel: 'Thêm quán cafe',
  searchPlaceholder: 'Tìm theo tên, địa chỉ, ghi chú…',
  emptyTitle: 'Chưa có quán cafe nào',
  emptyDescription: 'Thêm quán đầu tiên để bắt đầu xây dựng bộ sưu tập chỗ hẹn hò.',
  showAmenities: true,
  showCuisine: false,
};

export const BAR_CONFIG: PlaceTypeConfig = {
  type: 'bar',
  icon: '🍸',
  title: 'Quán bar',
  subtitle: 'Chỗ uống buổi tối, rooftop và pub cho những dịp đặc biệt',
  addLabel: 'Thêm quán bar',
  searchPlaceholder: 'Tìm theo tên, địa chỉ, ghi chú…',
  emptyTitle: 'Chưa có quán bar nào',
  emptyDescription: 'Thêm quán đầu tiên để dành cho những buổi hẹn tối muộn.',
  showAmenities: true,
  showCuisine: false,
};

export const RESTAURANT_CONFIG: PlaceTypeConfig = {
  type: 'restaurant',
  icon: '🍜',
  title: 'Quán ăn',
  subtitle: 'Danh sách quán ngon đã ăn và muốn dẫn nàng đi',
  addLabel: 'Thêm quán ăn',
  searchPlaceholder: 'Tìm theo tên, địa chỉ, loại món…',
  emptyTitle: 'Chưa có quán ăn nào',
  emptyDescription: 'Thêm quán đầu tiên để lần sau khỏi phải nghĩ "ăn gì bây giờ".',
  showAmenities: false,
  showCuisine: true,
};
