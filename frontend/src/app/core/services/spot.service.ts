import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from '../api/api';
import { SILENT_CODES } from '../api/http-context';
import { FeaturedSpot, FeaturedSpotRequest, SpotCategory, SpotItem, SpotPage } from '../models/spot.model';
import { Vibe } from '../models/vibe.model';
import { toQueryParams } from '../api/query-params';

export interface SpotQuery {
  q?: string;
  category?: SpotCategory | '';
  district?: string;
  /** Giá thấp nhất không quá mức này (0 = chỉ chỗ miễn phí) */
  maxPrice?: number | null;
  indoor?: boolean | null;
  /** "HH:mm" theo giờ của người xem: chỉ lấy chỗ đang mở */
  openAt?: string;
  /** Thời lượng gợi ý (phút) */
  minDuration?: number;
  maxDuration?: number;
  /** Chỉ chỗ không cần đặt trước */
  noBooking?: boolean;
  vibe?: Vibe[];
  sort?: string;
  page?: number;
  size?: number;
}

/** Chỉ gửi bộ lọc có giá trị (0 vẫn gửi: "miễn phí"). */
const toParams = toQueryParams;

/** Dữ liệu admin gửi khi thêm/sửa chỗ chơi. `version`: bỏ qua khi thêm. */
export type SpotRequest = Omit<
  SpotItem,
  'id' | 'districtLabel' | 'createdAt' | 'updatedAt' | 'version' | 'vibesSource' | 'inMyPlace' | 'ratingAvg' | 'ratingCount' | 'slug'
> & {
  /** true = để hệ thống tự gán nhãn theo nhóm */
  vibesAuto?: boolean;
  version?: number;
};

/**
 * "Tìm chỗ chơi": mọi người xem; chỉ admin thêm/sửa/xoá. VERSION_CONFLICT do trang tự xử lý.
 * Danh sách khu vực dùng chung CatalogService.districts().
 */
@Injectable({ providedIn: 'root' })
export class SpotService {
  private readonly http = inject(HttpClient);

  search(query: SpotQuery): Promise<SpotPage> {
    return firstValueFrom(this.http.get<SpotPage>(`${API_BASE}/spots`, { params: toParams(query) }));
  }

  /** Số chỗ chơi theo nhóm (khoá `all` là tổng), theo mọi bộ lọc trừ nhóm. */
  counts(query: Omit<SpotQuery, 'category' | 'page' | 'size'>): Promise<Record<string, number>> {
    return firstValueFrom(this.http.get<Record<string, number>>(`${API_BASE}/spots/counts`, { params: toParams(query) }));
  }

  create(spot: SpotRequest): Promise<SpotItem> {
    return firstValueFrom(this.http.post<SpotItem>(`${API_BASE}/admin/spots`, spot));
  }

  update(id: string, spot: SpotRequest): Promise<SpotItem> {
    return firstValueFrom(
      this.http.put<SpotItem>(`${API_BASE}/admin/spots/${id}`, spot, {
        context: new HttpContext().set(SILENT_CODES, ['VERSION_CONFLICT']),
      }),
    );
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${API_BASE}/admin/spots/${id}`));
  }

  /** Trang riêng của chỗ chơi /cho-choi/{slug} */
  /** Ảnh nền banner Tìm chỗ chơi; imageUrl null = ảnh mặc định */
  banner(): Promise<{ imageUrl: string | null }> {
    return firstValueFrom(this.http.get<{ imageUrl: string | null }>(`${API_BASE}/spots/banner`));
  }

  /** Admin: đổi ảnh nền banner; null = quay về ảnh mặc định */
  setBanner(imageUrl: string | null): Promise<{ imageUrl: string | null }> {
    return firstValueFrom(this.http.put<{ imageUrl: string | null }>(`${API_BASE}/admin/spots/banner`, { imageUrl }));
  }

  /** Chỗ chơi nổi bật (công khai) */
  featured(): Promise<FeaturedSpot[]> {
    return firstValueFrom(this.http.get<FeaturedSpot[]>(`${API_BASE}/spots/featured`));
  }

  /** Admin: thay danh sách chỗ chơi nổi bật (thứ tự = vị trí) */
  setFeatured(list: FeaturedSpotRequest[]): Promise<FeaturedSpot[]> {
    return firstValueFrom(this.http.put<FeaturedSpot[]>(`${API_BASE}/admin/spots/featured`, list));
  }

  bySlug(slug: string): Promise<SpotItem> {
    return firstValueFrom(this.http.get<SpotItem>(`${API_BASE}/spots/by-slug/${encodeURIComponent(slug)}`));
  }
}
