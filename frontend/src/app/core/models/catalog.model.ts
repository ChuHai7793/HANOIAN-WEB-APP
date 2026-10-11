import { PlaceType } from './place.model';

/** Một quán trong "Khám phá quán" (dữ liệu OpenStreetMap). */
export interface CatalogItem {
  id: string;
  type: PlaceType;
  name: string;
  address: string | null;
  district: string | null;
  lat: number;
  lng: number;
  openingHours: string | null;
  cuisine: string | null;
  phone: string | null;
  website: string | null;
  hasWifi: boolean | null;
  inNotebook: boolean;
}

export interface CatalogPage {
  items: CatalogItem[];
  total: number;
  page: number;
  size: number;
  lastFetchedAt: string | null;
}

export interface DistrictOption {
  code: string;
  label: string;
}

export type ImportRunStatus = 'RUNNING' | 'DONE' | 'FAILED';

export interface ImportRun {
  id: string;
  status: ImportRunStatus;
  districts: string[];
  types: PlaceType[];
  totalCells: number;
  doneCells: number;
  added: number;
  updated: number;
  errors: string[];
  startedAt: string;
  finishedAt: string | null;
}

/** Mã món của OSM ("vietnamese;noodle") → lựa chọn trong form quán. */
const CUISINE_MAP: [RegExp, string][] = [
  [/vietnamese|pho|noodle/, 'Món Việt'],
  [/japanese|sushi|ramen/, 'Món Nhật'],
  [/korean/, 'Món Hàn'],
  [/thai/, 'Món Thái'],
  [/chinese|dim_sum|cantonese/, 'Món Trung'],
  [/hot_pot|hotpot/, 'Lẩu'],
  [/barbecue|bbq|grill/, 'Nướng BBQ'],
  [/seafood|fish/, 'Hải sản'],
  [/vegetarian|vegan/, 'Chay'],
  [/italian|french|pizza|burger|steak|western|european/, 'Món Âu'],
];

export function cuisineOption(osm: string | null): string | undefined {
  if (!osm) return undefined;
  const value = osm.toLowerCase();
  return CUISINE_MAP.find(([re]) => re.test(value))?.[1];
}

/** "Mo-Su 07:00-22:00" → giờ mở và đóng đầu tiên tìm thấy; chuỗi phức tạp hơn thì bỏ qua. */
export function openingHoursRange(raw: string | null): { open: string; close: string } | null {
  const m = raw?.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const pad = (h: string) => h.padStart(2, '0');
  const close = m[3] === '24' ? '23:59' : `${pad(m[3])}:${m[4]}`;
  return { open: `${pad(m[1])}:${m[2]}`, close };
}
