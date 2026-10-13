import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from '../api/api';
import { SpotItem } from '../models/spot.model';

/**
 * Chỗ chơi đã lưu vào My place của người đang đăng nhập (mỗi người một danh sách). Nạp cùng dữ liệu khác
 * lúc vào app (DataBootstrapService) để badge My place và nút "Lưu" biết trạng thái ngay.
 */
@Injectable({ providedIn: 'root' })
export class SavedSpotService {
  private readonly http = inject(HttpClient);

  private readonly list = signal<SpotItem[]>([]);
  readonly items = this.list.asReadonly();
  readonly count = computed(() => this.list().length);

  async load(): Promise<void> {
    this.list.set(await firstValueFrom(this.http.get<SpotItem[]>(`${API_BASE}/me/spots`)));
  }

  clear(): void {
    this.list.set([]);
  }

  has(id: string): boolean {
    return this.list().some((s) => s.id === id);
  }

  /** Lưu vào My place; trả về chỗ chơi (inMyPlace = true) để trang cập nhật thẻ. */
  async save(spot: SpotItem): Promise<SpotItem> {
    const saved = await firstValueFrom(this.http.post<SpotItem>(`${API_BASE}/spots/${spot.id}/my-place`, {}));
    this.list.update((l) => [saved, ...l.filter((s) => s.id !== saved.id)]);
    return saved;
  }

  async remove(id: string): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`${API_BASE}/spots/${id}/my-place`));
    this.list.update((l) => l.filter((s) => s.id !== id));
  }
}
