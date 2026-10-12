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

/** Dữ liệu admin gửi khi thêm/sửa chỗ chơi. `version`: bỏ qua khi thêm. */
export type SpotRequest = Omit<SpotItem, 'id' | 'districtLabel' | 'createdAt' | 'updatedAt' | 'version'> & {
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
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    }
    return firstValueFrom(this.http.get<SpotPage>(`${API_BASE}/spots`, { params }));
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
