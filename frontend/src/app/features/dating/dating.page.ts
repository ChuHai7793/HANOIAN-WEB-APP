import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { errorCode } from '../../core/api/api';
import {
  Candidate,
  DatingSettings,
  DatingSettingsRequest,
  Match,
} from '../../core/models/dating.model';
import { DatingService } from '../../core/services/dating.service';
import { ToastService } from '../../core/services/toast.service';
import { SwipeCardComponent } from './swipe-card.component';

type Tab = 'swipe' | 'matches';

/**
 * "Tìm đối tượng" kiểu Tinder: bật mục (cần ảnh, đủ 18 tuổi), quẹt thẻ, hai bên cùng thích thì "It's a
 * match!", tab Match liệt kê những người đã match.
 */
@Component({
  selector: 'app-dating-page',
  imports: [DatePipe, RouterLink, SwipeCardComponent],
  template: `
    <div class="p-4 sm:p-6 lg:p-8">
      <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="flex items-center gap-2 text-2xl font-bold text-slate-900"><span>💘</span> Tìm đối tượng</h1>
          <p class="mt-1 text-sm text-slate-500">Quẹt phải để thích, quẹt trái để bỏ qua. Hai bên cùng thích là match.</p>
        </div>
        @if (settings()?.enabled) {
          <div class="flex items-center gap-2">
          <button
            type="button"
            class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            title="Bộ lọc"
            (click)="openFilters()"
          >
            ⚙️ Bộ lọc
          </button>
          <div class="flex rounded-lg bg-slate-100 p-1 text-sm">
            <button
              type="button"
              class="rounded-md px-3 py-1.5 font-medium"
              [class]="tab() === 'swipe' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'"
              (click)="tab.set('swipe')"
            >
              🔥 Quẹt
            </button>
            <button
              type="button"
              class="rounded-md px-3 py-1.5 font-medium"
              [class]="tab() === 'matches' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'"
              (click)="openMatches()"
            >
              💞 Match
            </button>
          </div>
          </div>
        }
      </div>

      @if (!settings()) {
        <p class="text-sm text-slate-500">Đang tải…</p>
      } @else if (!settings()!.enabled) {
        <!-- Chưa bật: giới thiệu, điều kiện, thông báo quyền của admin -->
        <div class="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p class="text-5xl">💘</p>
          <h2 class="mt-3 text-lg font-bold text-slate-900">Bật Tìm đối tượng</h2>
          <p class="mt-2 text-sm text-slate-600">
            Hồ sơ của bạn (ảnh, tên, tuổi, thành phố, giới thiệu) sẽ hiện cho người dùng khác cùng bật mục
            này. Chỉ người từ 18 tuổi.
          </p>
          @if (settings()!.missing.length) {
            <p class="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Cần bổ sung trong
              <a routerLink="/profile" class="font-semibold underline">Hồ sơ của tôi</a>:
              {{ settings()!.missing.join(', ') }}.
            </p>
          }
          <p class="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Quản trị viên có thể xem hồ sơ và hoạt động của bạn trong mục này (ai bạn đã thích, các match).
          </p>
          <button
            type="button"
            class="mt-5 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            [disabled]="settings()!.missing.length > 0 || busy()"
            (click)="enable()"
          >
            Bật và bắt đầu quẹt
          </button>
        </div>
      } @else if (tab() === 'swipe') {
        <div class="mx-auto flex max-w-sm flex-col items-center">
          <div class="relative h-[min(70vh,560px)] w-full">
            @if (deck().length > 1) {
              <!-- Thẻ kế tiếp nằm phía sau -->
              <div class="absolute inset-0 scale-95 overflow-hidden rounded-3xl bg-slate-200 opacity-70">
                @if (deck()[1].avatarUrl) {
                  <img [src]="deck()[1].avatarUrl" alt="" class="h-full w-full object-cover" />
                }
              </div>
            }
            @if (deck()[0]; as top) {
              <div class="absolute inset-0">
                <!-- @for theo userId: mỗi người một thẻ mới (trạng thái kéo không dính sang người sau) -->
                @for (c of [top]; track c.userId) {
                  <app-swipe-card #card [candidate]="c" (swiped)="onSwiped(c, $event)" />
                }
              </div>
            } @else {
              <div class="flex h-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 text-center text-slate-500">
                <p class="text-4xl">🌙</p>
                <p class="mt-2 text-sm">{{ loading() ? 'Đang tìm người…' : 'Hết người để quẹt rồi. Quay lại sau nhé!' }}</p>
              </div>
            }
          </div>
          <div class="mt-5 flex items-center gap-5">
            <button type="button" class="flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl shadow-md hover:scale-105 disabled:opacity-40" title="Hoàn tác" [disabled]="busy()" (click)="undo()">↩️</button>
            <button type="button" class="flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl shadow-md hover:scale-105 disabled:opacity-40" title="Bỏ qua" [disabled]="!deck().length || busy()" (click)="card()?.fling(false)">✖️</button>
            <button type="button" class="flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl shadow-md hover:scale-105 disabled:opacity-40" title="Thích" [disabled]="!deck().length || busy()" (click)="card()?.fling(true)">❤️</button>
          </div>
        </div>
      } @else {
        <!-- Tab Match -->
        @if (matches().length === 0) {
          <p class="text-sm text-slate-500">Chưa có match nào. Quẹt thêm nhé!</p>
        } @else {
          <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            @for (m of matches(); track m.id) {
              <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div class="aspect-[3/4] bg-slate-200">
                  @if (m.user.avatarUrl) {
                    <img [src]="m.user.avatarUrl" alt="" class="h-full w-full object-cover" loading="lazy" />
                  }
                </div>
                <div class="p-3">
                  <p class="font-semibold text-slate-900">{{ m.user.displayName }}, {{ m.user.age }}</p>
                  <p class="text-xs text-slate-500">
                    {{ m.user.city || '' }} · match {{ m.matchedAt | date: 'dd/MM/yyyy' }}
                  </p>
                </div>
              </div>
            }
          </div>
        }
      }
    </div>

    @if (filters(); as f) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" (click)="filters.set(null)">
        <div class="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" (click)="$event.stopPropagation()">
          <h2 class="mb-4 text-lg font-bold text-slate-900">⚙️ Bộ lọc</h2>
          <label class="mb-1 block text-sm font-medium text-slate-700">Muốn gặp</label>
          <select
            class="mb-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            [value]="f.interestedIn"
            (change)="filters.set({ ...f, interestedIn: $any($event.target).value })"
          >
            <option value="all">Tất cả</option>
            <option value="female">Nữ</option>
            <option value="male">Nam</option>
          </select>
          <label class="mb-1 block text-sm font-medium text-slate-700">Tuổi</label>
          <div class="mb-4 flex items-center gap-2">
            <input
              type="number" min="18" max="99"
              class="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              [value]="f.ageMin"
              (input)="filters.set({ ...f, ageMin: +$any($event.target).value })"
            />
            <span class="text-slate-400">–</span>
            <input
              type="number" min="18" max="99"
              class="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              [value]="f.ageMax"
              (input)="filters.set({ ...f, ageMax: +$any($event.target).value })"
            />
          </div>
          <label class="mb-5 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              class="h-4 w-4 accent-brand-600"
              [checked]="f.sameCityOnly"
              (change)="filters.set({ ...f, sameCityOnly: $any($event.target).checked })"
            />
            Chỉ người cùng thành phố với tôi
          </label>
          @if (filterError()) {
            <p class="mb-3 text-xs text-rose-600">{{ filterError() }}</p>
          }
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" class="text-xs font-medium text-rose-600 hover:underline" (click)="disable()">
              Tắt Tìm đối tượng
            </button>
            <span class="flex-1"></span>
            <button type="button" class="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600" (click)="filters.set(null)">Huỷ</button>
            <button type="button" class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700" (click)="saveFilters()">Lưu</button>
          </div>
        </div>
      </div>
    }

    @if (justMatched(); as m) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-brand-600/95 to-rose-500/95 p-6 text-center text-white">
        <div class="max-w-sm">
          <p class="text-4xl font-black italic">It's a match!</p>
          <p class="mt-2 text-sm opacity-90">Bạn và {{ m.user.displayName }} đã thích nhau.</p>
          @if (m.user.avatarUrl) {
            <img [src]="m.user.avatarUrl" alt="" class="mx-auto mt-6 h-40 w-40 rounded-full border-4 border-white object-cover shadow-lg" />
          }
          <div class="mt-8 flex flex-col gap-3">
            <button type="button" class="rounded-full bg-white px-5 py-2.5 font-semibold text-brand-700" (click)="justMatched.set(null); openMatches()">Xem match</button>
            <button type="button" class="rounded-full border border-white/70 px-5 py-2.5 font-semibold" (click)="justMatched.set(null)">Quẹt tiếp</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class DatingPage implements OnInit {
  private readonly dating = inject(DatingService);
  private readonly toast = inject(ToastService);

  protected readonly card = viewChild<SwipeCardComponent>('card');
  protected readonly tab = signal<Tab>('swipe');
  protected readonly settings = signal<DatingSettings | null>(null);
  protected readonly deck = signal<Candidate[]>([]);
  protected readonly matches = signal<Match[]>([]);
  protected readonly justMatched = signal<Match | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  /** Bộ lọc đang sửa (null = đóng hộp) */
  protected readonly filters = signal<DatingSettingsRequest | null>(null);
  protected readonly filterError = signal('');

  async ngOnInit(): Promise<void> {
    const s = await this.dating.settings();
    this.settings.set(s);
    if (s.enabled) await this.loadDeck();
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
      await this.loadDeck();
    } finally {
      this.busy.set(false);
    }
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
    this.matches.set(await this.dating.matches());
  }

  /** Thẻ đã bay ra: bỏ khỏi chồng thẻ ngay, gọi API sau (lỗi thì báo) */
  protected async onSwiped(c: Candidate, liked: boolean): Promise<void> {
    this.deck.update((list) => list.filter((x) => x.userId !== c.userId));
    try {
      const res = await this.dating.swipe(c.userId, liked);
      if (res.matched && res.match) this.justMatched.set(res.match);
    } catch (err) {
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
