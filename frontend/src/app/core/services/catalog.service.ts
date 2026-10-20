import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from '../api/api';
import { SILENT_CODES } from '../api/http-context';
import { CatalogItem, CatalogPage, DistrictOption, FeaturedItem, FeaturedRequest, TypeCounts } from '../models/catalog.model';
import { Place, PlaceType } from '../models/place.model';
import { toQueryParams } from '../api/query-params';
import { Vibe } from '../models/vibe.model';

export interface CatalogQuery {
  q?: string;
  type?: PlaceType | '';
  district?: string;
  /** Chỉ quán đã có trong My place của mình */
  mine?: boolean;
  /** Bộ lọc chi tiết (xem CatalogFilter ở backend); priceMin / priceMax: VNĐ mỗi người */
  priceMin?: number | null;
  priceMax?: number | null;
  stars?: number | null;
  cuisine?: string[];
  vibe?: Vibe[];
  /** "HH:mm" theo giờ người xem: chỉ quán đang mở */
  openAt?: string;
  wifi?: boolean;
  parking?: boolean;
  sort?: string;
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
    return firstValueFrom(this.http.get<CatalogPage>(`${API_BASE}/catalog`, { params: toQueryParams(query) }));
  }

  /** Số quán theo loại, theo mọi bộ lọc trừ loại. */
  counts(query: Omit<CatalogQuery, 'type' | 'mine' | 'sort' | 'page' | 'size'>): Promise<TypeCounts> {
    return firstValueFrom(this.http.get<TypeCounts>(`${API_BASE}/catalog/counts`, { params: toQueryParams(query) }));
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

  /** Trang riêng của quán /quan/{slug} */
  bySlug(slug: string): Promise<CatalogItem> {
    return firstValueFrom(this.http.get<CatalogItem>(`${API_BASE}/catalog/by-slug/${encodeURIComponent(slug)}`));
  }

  /** Ảnh nền banner Khám phá quán; imageUrl null = ảnh mặc định */
  banner(): Promise<{ imageUrl: string | null }> {
    return firstValueFrom(this.http.get<{ imageUrl: string | null }>(`${API_BASE}/catalog/banner`));
  }

  /** Admin: đổi ảnh nền; null = quay về ảnh mặc định */
  setBanner(imageUrl: string | null): Promise<{ imageUrl: string | null }> {
    return firstValueFrom(this.http.put<{ imageUrl: string | null }>(`${API_BASE}/admin/catalog/banner`, { imageUrl }));
  }

  /** Điểm hẹn nổi bật (công khai) */
  featured(): Promise<FeaturedItem[]> {
    return firstValueFrom(this.http.get<FeaturedItem[]>(`${API_BASE}/catalog/featured`));
  }

  /** Admin: thay danh sách nổi bật (thứ tự = vị trí; rỗng = tắt) */
  setFeatured(list: FeaturedRequest[]): Promise<FeaturedItem[]> {
    return firstValueFrom(this.http.put<FeaturedItem[]>(`${API_BASE}/admin/catalog/featured`, list));
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${API_BASE}/admin/catalog/${id}`));
  }
}
