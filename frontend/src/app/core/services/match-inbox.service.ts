import { computed, DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../auth/auth.service';
import { Match } from '../models/dating.model';
import { DatingService } from './dating.service';
import { RealtimeService } from './realtime.service';

/** Gom nhiều sự kiện liền nhau (vd. 5 tin tới cùng lúc) thành một lần tải lại danh sách. */
const REFRESH_DELAY_MS = 300;

/**
 * Danh sách match của người đang đăng nhập, dùng chung cho tab Match, trang Người yêu và số tin chưa đọc
 * trên menu. Tự tải lại khi server báo có tin mới, match mới, bỏ match.
 */
@Injectable({ providedIn: 'root' })
export class MatchInboxService {
  private readonly dating = inject(DatingService);
  private readonly auth = inject(AuthService);
  private timer: ReturnType<typeof setTimeout> | undefined;

  private readonly list = signal<Match[]>([]);
  readonly matches = this.list.asReadonly();
  /** Tổng số tin người khác gửi mà mình chưa xem */
  readonly unread = computed(() => this.list().reduce((sum, m) => sum + m.unread, 0));

  constructor() {
    effect(() => {
      const loggedIn = this.auth.isLoggedIn();
      untracked(() => (loggedIn ? void this.refresh() : this.list.set([])));
    });
    inject(RealtimeService)
      .events.pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((e) => {
        if (e.type === 'unmatch') this.list.update((l) => l.filter((m) => m.id !== e.data.matchId));
        if (e.type !== 'read') this.refreshSoon();
      });
  }

  /** Tải lại ngay. Lỗi thì giữ danh sách cũ (không hiện thông báo: đây là việc chạy nền). */
  async refresh(): Promise<void> {
    try {
      this.list.set(await this.dating.matches(true));
    } catch {
      // giữ nguyên
    }
  }

  refreshSoon(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.refresh(), REFRESH_DELAY_MS);
  }

  /** Bỏ match / chặn ở máy này: bỏ khỏi danh sách ngay, không chờ server. */
  removeUser(userId: string): void {
    this.list.update((l) => l.filter((m) => m.user.userId !== userId));
  }
}
