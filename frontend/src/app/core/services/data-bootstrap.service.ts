import { inject, Injectable, signal } from '@angular/core';
import { PlaceService } from './place.service';
import { GirlfriendService } from './girlfriend.service';
import { PlaceLinkService } from './place-link.service';

export type BootstrapStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Tải cả 3 bảng một lần (dữ liệu nhỏ), để các màn hình giữ nguyên logic lọc/sắp xếp ở client.
 * TODO(Phase 4): gọi sau khi đăng nhập thay vì lúc khởi động app.
 */
@Injectable({ providedIn: 'root' })
export class DataBootstrapService {
  private readonly places = inject(PlaceService);
  private readonly girlfriends = inject(GirlfriendService);
  private readonly links = inject(PlaceLinkService);

  readonly status = signal<BootstrapStatus>('idle');

  /** Không bao giờ reject: lỗi thể hiện qua `status` để app vẫn khởi động được. */
  async loadAll(): Promise<void> {
    this.status.set('loading');
    try {
      await Promise.all([this.places.load(), this.girlfriends.load(), this.links.load()]);
      this.status.set('ready');
    } catch {
      this.status.set('error');
    }
  }
}
