import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { errorCode } from '../../core/api/api';
import {
  Candidate,
  DatingSettings,
  DatingSettingsRequest,
  Match,
} from '../../core/models/dating.model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatingService } from '../../core/services/dating.service';
import { MatchInboxService } from '../../core/services/match-inbox.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { ToastService } from '../../core/services/toast.service';
import { SwipeCardComponent } from './swipe-card.component';
import { ReportDialogComponent, ReportInput } from './report-dialog.component';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog.component';
import { placePriceText, PlaceType } from '../../core/models/place.model';
import { IconComponent } from '../../shared/ui/icon.component';
import { AuthService } from '../../core/auth/auth.service';

type Tab = 'swipe' | 'matches';

/**
 * "Tìm đối tượng" kiểu Tinder: bật mục (cần ảnh, đủ 18 tuổi), quẹt thẻ, hai bên cùng thích thì "It's a
 * match!", tab Match liệt kê những người đã match.
 */
@Component({
  selector: 'app-dating-page',
  imports: [DatePipe, RouterLink, SwipeCardComponent, ReportDialogComponent, ConfirmDialogComponent, IconComponent],
  templateUrl: './dating.page.html',
})
export class DatingPage implements OnInit {
  private readonly dating = inject(DatingService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly inbox = inject(MatchInboxService);

  constructor() {
    // Người kia vừa thích lại mình: báo ngay
    inject(RealtimeService)
      .events.pipe(takeUntilDestroyed())
      .subscribe((e) => {
        if (e.type === 'match') this.toast.success(`Bạn và ${e.data.user.displayName} vừa match! Vào tab Match để nhắn tin.`);
        if (e.type === 'super_like') {
          this.toast.success('Có người vừa siêu thích bạn! Họ sẽ hiện đầu tiên khi bạn quẹt.');
          void this.loadDeck();
        }
      });
  }

  protected readonly card = viewChild<SwipeCardComponent>('card');
  protected readonly tab = signal<Tab>('swipe');
  /** Đang quẹt: trang cao đúng bằng màn hình để thẻ, hàng nút và "Báo cáo" vừa một màn hình */
  protected readonly fitScreen = computed(() => {
    const s = this.settings();
    return this.tab() === 'swipe' && !!s && s.enabled && !s.banned;
  });
  protected readonly settings = signal<DatingSettings | null>(null);
  protected readonly deck = signal<Candidate[]>([]);
  /** Danh sách match dùng chung, tự cập nhật khi có tin / match mới */
  protected readonly matches = this.inbox.matches;
  /** Panel "Match gần đây": 4 người đầu danh sách */
  protected readonly recentMatches = computed(() => this.matches().slice(0, 4));
  /** Người đang đăng nhập: ảnh của mình trong popup match */
  protected readonly me = inject(AuthService).user;
  /** Hôm nay (giờ Việt Nam): số người đã thích, lượt siêu thích còn lại */
  protected readonly likedToday = signal(0);
  protected readonly superLeft = signal(0);
  protected readonly typeLabel: Record<PlaceType, string> = { cafe: 'Cafe', bar: 'Bar', restaurant: 'Quán ăn' };
  protected readonly price = placePriceText;
  protected readonly justMatched = signal<Match | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  /** Bộ lọc đang sửa (null = đóng hộp) */
  protected readonly filters = signal<DatingSettingsRequest | null>(null);
  protected readonly filterError = signal('');
  /** Người đang được báo cáo (null = đóng hộp) */
  protected readonly reporting = signal<{ userId: string; name: string } | null>(null);
  /** Bỏ match hoặc chặn đang chờ xác nhận */
  protected readonly pending = signal<{ kind: 'unmatch' | 'block'; match: Match } | null>(null);

  async ngOnInit(): Promise<void> {
    const s = await this.dating.settings();
    this.settings.set(s);
    // Quay lại từ trang nhắn tin: mở thẳng tab Match
    if (this.route.snapshot.queryParamMap.get('tab') === 'matches') await this.openMatches();
    if (s.enabled) await Promise.all([this.loadDeck(), this.loadToday()]);
  }

  private async loadToday(): Promise<void> {
    const t = await this.dating.today();
    this.likedToday.set(t.liked);
    this.superLeft.set(t.superLikesLeft);
  }

  /** "Minh Trang" → "MT" */
  protected initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  protected chatWith(m: Match): void {
    this.justMatched.set(null);
    void this.router.navigate(['/dating/matches', m.id]);
  }

  protected async enable(): Promise<void> {
    const s = this.settings();
    if (!s) return;
    this.busy.set(true);
    try {
      this.settings.set(
        await this.dating.saveSettings({
          enabled: true,
          interestedIn: s.interestedIn,
          ageMin: s.ageMin,
          ageMax: s.ageMax,
          sameCityOnly: s.sameCityOnly,
        }),
      );
      await Promise.all([this.loadDeck(), this.loadToday()]);
    } finally {
      this.busy.set(false);
    }
  }

  protected async sendReport(userId: string, input: ReportInput): Promise<void> {
    this.reporting.set(null);
    await this.dating.report(userId, input.reason, input.note, input.block);
    // Chặn thì người đó biến khỏi thẻ và danh sách match
    if (input.block) this.removePerson(userId);
    this.toast.success(input.block ? 'Đã gửi báo cáo và chặn người này.' : 'Đã gửi báo cáo tới quản trị viên.');
  }

  protected async confirmPending(): Promise<void> {
    const p = this.pending();
    if (!p) return;
    this.pending.set(null);
    if (p.kind === 'unmatch') {
      await this.dating.unmatch(p.match.id);
      this.toast.success(`Đã bỏ match với ${p.match.user.displayName}.`);
    } else {
      await this.dating.block(p.match.user.userId);
      this.toast.success(`Đã chặn ${p.match.user.displayName}.`);
    }
    this.removePerson(p.match.user.userId);
  }

  private removePerson(userId: string): void {
    this.deck.update((list) => list.filter((c) => c.userId !== userId));
    this.inbox.removeUser(userId);
  }

  protected openFilters(): void {
    const s = this.settings();
    if (!s) return;
    this.filterError.set('');
    this.filters.set({
      enabled: s.enabled,
      interestedIn: s.interestedIn,
      ageMin: s.ageMin,
      ageMax: s.ageMax,
      sameCityOnly: s.sameCityOnly,
    });
  }

  /** Lưu bộ lọc rồi lấy lại chồng thẻ theo bộ lọc mới */
  protected async saveFilters(): Promise<void> {
    const f = this.filters();
    if (!f) return;
    if (f.ageMin < 18 || f.ageMax > 99 || f.ageMin > f.ageMax) {
      this.filterError.set('Tuổi từ 18 đến 99, tuổi nhỏ nhất không lớn hơn tuổi lớn nhất.');
      return;
    }
    this.settings.set(await this.dating.saveSettings(f));
    this.filters.set(null);
    this.deck.set([]);
    await this.loadDeck();
  }

  /** Ẩn hồ sơ khỏi mục này; quay về màn hình giới thiệu */
  protected async disable(): Promise<void> {
    const f = this.filters();
    if (!f) return;
    this.settings.set(await this.dating.saveSettings({ ...f, enabled: false }));
    this.filters.set(null);
    this.deck.set([]);
    this.tab.set('swipe');
    this.toast.success('Đã tắt Tìm đối tượng. Hồ sơ của bạn không còn hiện cho người khác.');
  }

  protected async openMatches(): Promise<void> {
    this.tab.set('matches');
    await this.inbox.refresh();
  }

  /** Thẻ đã bay ra: bỏ khỏi chồng thẻ ngay, gọi API sau (lỗi thì báo) */
  protected async onSwiped(c: Candidate, liked: boolean, superLike = false): Promise<void> {
    this.deck.update((list) => list.filter((x) => x.userId !== c.userId));
    try {
      const res = await this.dating.swipe(c.userId, liked, superLike);
      if (liked) this.likedToday.update((n) => n + 1);
      if (superLike) this.superLeft.update((n) => Math.max(0, n - 1));
      if (res.matched && res.match) this.justMatched.set(res.match);
    } catch (err) {
      if (errorCode(err) === 'SUPER_LIKE_LIMIT') {
        // Hết lượt (vd. đã dùng ở tab khác): đưa thẻ lại để quẹt thường
        this.superLeft.set(0);
        this.deck.update((list) => [c, ...list]);
        this.toast.error('Bạn đã dùng hết lượt siêu thích hôm nay.');
        return;
      }
      // ALREADY_SWIPED: đã quẹt ở tab khác, bỏ qua; lỗi khác errorInterceptor đã báo
      if (errorCode(err) !== 'ALREADY_SWIPED') return;
    }
    if (this.deck().length < 2) await this.loadDeck();
  }

  protected async undo(): Promise<void> {
    this.busy.set(true);
    try {
      const { restored } = await this.dating.undo();
      this.deck.update((list) => [restored, ...list.filter((x) => x.userId !== restored.userId)]);
      // Hoàn tác hoàn lại lượt thích / siêu thích: lấy lại số từ server
      await this.loadToday();
    } catch (err) {
      if (errorCode(err) === 'NOT_FOUND') this.toast.error('Không còn lượt quẹt nào để hoàn tác.');
    } finally {
      this.busy.set(false);
    }
  }

  /** Lấy thêm thẻ, giữ thẻ đang hiện ở đầu */
  private async loadDeck(): Promise<void> {
    this.loading.set(true);
    try {
      const fresh = await this.dating.deck();
      this.deck.update((list) => [...list, ...fresh.filter((f) => !list.some((x) => x.userId === f.userId))]);
    } finally {
      this.loading.set(false);
    }
  }
}
