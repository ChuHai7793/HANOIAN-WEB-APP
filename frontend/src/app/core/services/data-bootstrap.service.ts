import { inject, Injectable, Injector, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { PlaceService } from './place.service';
import { GirlfriendService } from './girlfriend.service';
import { PlaceLinkService } from './place-link.service';
import { SavedSpotService } from './saved-spot.service';

export type BootstrapStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Tải cả 3 bảng một lần (dữ liệu nhỏ), để các màn hình giữ nguyên logic lọc/sắp xếp ở client.
 * Gọi sau khi đăng nhập / khôi phục phiên; đăng xuất thì {@link clear}.
 */
@Injectable({ providedIn: 'root' })
export class DataBootstrapService {
  private readonly places = inject(PlaceService);
  private readonly girlfriends = inject(GirlfriendService);
  private readonly links = inject(PlaceLinkService);
  private readonly savedSpots = inject(SavedSpotService);
  /** AuthService cũng inject service này: lấy lúc gọi để không vòng phụ thuộc */
  private readonly injector = inject(Injector);

  readonly status = signal<BootstrapStatus>('idle');

  /** Không bao giờ reject: lỗi thể hiện qua `status` để app vẫn khởi động được. */
  async loadAll(): Promise<void> {
    this.status.set('loading');
    try {
      // Người yêu và liên kết quán là dữ liệu riêng của admin: backend trả 403 cho guest, không tải
      const admin = this.injector.get(AuthService).user()?.role === 'ADMIN';
      await Promise.all([
        this.places.load(),
        this.savedSpots.load(),
        ...(admin ? [this.girlfriends.load(), this.links.load()] : []),
      ]);
      this.status.set('ready');
    } catch {
      this.status.set('error');
    }
  }

  /** Đăng xuất: xoá dữ liệu của tài khoản cũ khỏi bộ nhớ. */
  clear(): void {
    this.places.clear();
    this.girlfriends.clear();
    this.links.clear();
    this.savedSpots.clear();
    this.status.set('idle');
  }
}
