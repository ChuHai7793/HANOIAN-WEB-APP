import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from '../api/api';
import { SILENT_CODES } from '../api/http-context';
import { SpotCategory, SpotItem, SpotPage } from '../models/spot.model';

export interface SpotQuery {
  q?: string;
  category?: SpotCategory | '';
  district?: string;
  /** Giá thấp nhất không quá mức này (0 = chỉ chỗ miễn phí) */
  maxPrice?: number | null;
  indoor?: boolean | null;
  /** "HH:mm" theo giờ của người xem: chỉ lấy chỗ đang mở */
  openAt?: string;
  page?: number;
  size?: number;
}

/** Chỉ gửi bộ lọc có giá trị (0 vẫn gửi: "miễn phí"). */
function toParams(query: object): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
  }
  return params;
}

/** Dữ liệu admin gửi khi thêm/sửa chỗ chơi. `version`: bỏ qua khi thêm. */
export type SpotRequest = Omit<
  SpotItem,
  'id' | 'districtLabel' | 'createdAt' | 'updatedAt' | 'version' | 'vibesSource' | 'inMyPlace' | 'ratingAvg' | 'ratingCount'
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
}
