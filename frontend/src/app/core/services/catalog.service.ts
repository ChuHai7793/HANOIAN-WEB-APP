import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from '../api/api';
import { SILENT_CODES } from '../api/http-context';
import { CatalogItem, CatalogPage, DistrictOption, TypeCounts } from '../models/catalog.model';
import { Place, PlaceType } from '../models/place.model';
import { Vibe } from '../models/vibe.model';

export interface CatalogQuery {
  q?: string;
  type?: PlaceType | '';
  district?: string;
  /** Chỉ quán đã có trong My place của mình */
  mine?: boolean;
  page?: number;
  size?: number;
}

/** Dữ liệu admin gửi khi thêm/sửa quán trong danh mục. `version`: bỏ qua khi thêm. */
export type CatalogRequest = Omit<Place, 'id' | 'createdAt' | 'updatedAt' | 'version'> & {
  district: string;
  vibes?: Vibe[];
  /** true = để hệ thống tự gán nhãn theo loại */
  vibesAuto?: boolean;
  version?: number;
};

/**
 * "Khám phá quán": mọi người xem và add vào My place của mình; chỉ admin thêm/sửa/xoá.
 * VERSION_CONFLICT và ALREADY_IN_MY_PLACE do nơi gọi tự xử lý, không hiện toast chung.
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);

  search(query: CatalogQuery): Promise<CatalogPage> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    }
    return firstValueFrom(this.http.get<CatalogPage>(`${API_BASE}/catalog`, { params }));
  }

  /** Số quán theo loại, theo từ khoá và khu vực (không theo loại). */
  counts(query: Pick<CatalogQuery, 'q' | 'district'>): Promise<TypeCounts> {
    let params = new HttpParams();
    if (query.q) params = params.set('q', query.q);
    if (query.district) params = params.set('district', query.district);
    return firstValueFrom(this.http.get<TypeCounts>(`${API_BASE}/catalog/counts`, { params }));
  }

  districts(): Promise<DistrictOption[]> {
    return firstValueFrom(this.http.get<DistrictOption[]>(`${API_BASE}/catalog/districts`));
  }

  /** Lưu quán vào My place của người đang đăng nhập; trả về quán vừa tạo trong My place. */
  addToMyPlace(id: string): Promise<Place> {
    return firstValueFrom(
      this.http.post<Place>(`${API_BASE}/catalog/${id}/my-place`, null, {
        context: new HttpContext().set(SILENT_CODES, ['ALREADY_IN_MY_PLACE']),
      }),
    );
  }

  create(item: CatalogRequest): Promise<CatalogItem> {
    return firstValueFrom(this.http.post<CatalogItem>(`${API_BASE}/admin/catalog`, item));
  }

  update(id: string, item: CatalogRequest): Promise<CatalogItem> {
    return firstValueFrom(
      this.http.put<CatalogItem>(`${API_BASE}/admin/catalog/${id}`, item, {
        context: new HttpContext().set(SILENT_CODES, ['VERSION_CONFLICT']),
      }),
    );
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${API_BASE}/admin/catalog/${id}`));
  }
}
