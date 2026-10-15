import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChatMessage, DATING_STATUSES, DatingActivity, DatingStatus, REPORT_REASONS, ReportReason } from '../../core/models/dating.model';
import { GENDERS } from '../../core/models/profile.model';
import { DatingService } from '../../core/services/dating.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared/ui/icon.component';

/**
 * Chỉ admin: chi tiết một người dùng (/admin/users/:id). Hồ sơ đầy đủ, trạng thái Tìm đối tượng (thiếu gì),
 * mức dùng app, ai thích ai, match (đọc tin nhắn), các báo cáo về người này, khoá / mở khoá.
 * Bấm tên người khác trong trang: sang chi tiết người đó (cùng component, đổi input id).
 */
@Component({
  selector: 'app-admin-user-detail-page',
  imports: [DatePipe, IconComponent, RouterLink],
  template: `
    <div class="mx-auto flex max-w-5xl flex-col gap-5 p-4 sm:p-5 lg:p-6">
      <a routerLink="/admin/users" class="flex w-fit items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800">
        <span class="rotate-180"><app-icon name="arrowRight" [size]="14" /></span>Người dùng
      </a>

      @if (notFound()) {
        <p class="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">Không tìm thấy người dùng này.</p>
      } @else if (data(); as a) {
        @let u = a.summary;
        @let d = a.detail;
        <!-- Đầu trang: ảnh, tên, trạng thái, khoá -->
        <section class="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5">
          @if (u.user.avatarUrl) {
            <img [src]="u.user.avatarUrl" alt="" class="h-20 w-20 shrink-0 rounded-full object-cover" />
          } @else {
            <span class="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-brand-100 text-2xl font-semibold text-brand-700">{{ initial(u.user.displayName) }}</span>
          }
          <div class="min-w-0 flex-1">
            <h1 class="flex flex-wrap items-center gap-2 text-xl font-bold text-slate-900">
              {{ u.user.displayName }}
              <span class="rounded px-1.5 py-0.5 text-[11px] font-medium" [class]="u.role === 'ADMIN' ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'">{{ u.role === 'ADMIN' ? 'Admin' : 'Người dùng' }}</span>
              <span class="rounded px-2 py-0.5 text-xs font-medium" [class]="statusOf(u.status).tone">{{ statusOf(u.status).label }}</span>
            </h1>
            <p class="mt-1 text-sm text-slate-500">{{ u.user.email }}{{ u.username ? ' · @' + u.username : '' }} · Đăng ký {{ u.createdAt | date: 'dd/MM/yyyy HH:mm' }}</p>
            @if (d.missing.length && (u.status === 'INCOMPLETE' || u.status === 'NO_PROFILE')) {
              <p class="mt-2 flex items-start gap-1.5 text-xs text-amber-700">
                <span class="mt-px"><app-icon name="info" [size]="13" /></span>Chưa bật được Tìm đối tượng: thiếu {{ d.missing.join(', ') }}.
              </p>
            }
          </div>
          @if (u.status !== 'NO_PROFILE') {
            <button
              type="button"
              class="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
              [class]="u.banned ? 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50' : 'bg-rose-600 text-white hover:bg-rose-700'"
              [disabled]="busy()"
              (click)="setBan(!u.banned)"
            >
              <app-icon [name]="u.banned ? 'check' : 'ban'" [size]="15" class="mr-1.5 align-middle" />{{ u.banned ? 'Mở khoá Tìm đối tượng' : 'Khoá Tìm đối tượng' }}
            </button>
          }
        </section>

        <!-- Số liệu -->
        <section class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          @for (t of tiles(a); track t.label) {
            <div class="rounded-xl border border-slate-200 bg-white p-3">
              <p class="text-xs text-slate-500">{{ t.label }}</p>
              <p class="text-xl font-bold" [class]="t.alert ? 'text-rose-600' : 'text-slate-900'">{{ t.value }}</p>
            </div>
          }
        </section>

        <!-- Hồ sơ -->
        <section class="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 class="mb-3 text-sm font-semibold text-slate-700">Hồ sơ</h2>
          @if (u.status === 'NO_PROFILE') {
            <p class="text-sm italic text-slate-400">Chưa nhập hồ sơ.</p>
          } @else {
            <dl class="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div class="flex gap-2"><dt class="w-24 shrink-0 text-slate-400">Giới tính</dt><dd class="text-slate-700">{{ genderLabel(d.gender) }}</dd></div>
              <div class="flex gap-2"><dt class="w-24 shrink-0 text-slate-400">Ngày sinh</dt><dd class="text-slate-700">{{ d.birthday ? (d.birthday | date: 'dd/MM/yyyy') + ' (' + age(d.birthday) + ' tuổi)' : '—' }}</dd></div>
              <div class="flex gap-2"><dt class="w-24 shrink-0 text-slate-400">Điện thoại</dt><dd class="text-slate-700">{{ d.phone || '—' }}</dd></div>
              <div class="flex gap-2"><dt class="w-24 shrink-0 text-slate-400">Thành phố</dt><dd class="text-slate-700">{{ u.city || '—' }}</dd></div>
            </dl>
            @if (d.bio) {
              <p class="mt-3 whitespace-pre-line rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{{ d.bio }}</p>
            }
          }
        </section>

        <!-- Hoạt động Tìm đối tượng -->
        <section class="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 class="mb-3 text-sm font-semibold text-slate-700">Hoạt động Tìm đối tượng</h2>
          <div class="grid gap-4 sm:grid-cols-3">
            @for (col of columns(a); track col.title) {
              <div>
                <p class="mb-2 text-sm font-medium text-slate-600">{{ col.title }} ({{ col.items.length }})</p>
                @if (col.items.length === 0) {
                  <p class="text-xs text-slate-400">Không có</p>
                }
                <ul class="space-y-1.5">
                  @for (e of col.items; track e.user.id) {
                    <li class="text-xs">
                      <a [routerLink]="['/admin/users', e.user.id]" class="font-medium text-brand-700 hover:underline">{{ e.user.displayName }}</a>
                      <span class="text-slate-400"> · {{ e.at | date: 'dd/MM HH:mm' }}</span>
                      @if (e.matchId) {
                        <button type="button" class="ml-1 text-brand-700 hover:underline" (click)="openConversation(e.matchId, e.user.displayName)"><app-icon name="chat" [size]="13" class="mr-1 align-middle" />Tin nhắn</button>
                      }
                    </li>
                  }
                </ul>
              </div>
            }
          </div>

          @if (conversation(); as c) {
            <div class="mt-5 border-t border-slate-100 pt-4">
              <div class="mb-2 flex items-center justify-between">
                <p class="text-sm font-semibold text-slate-700"><app-icon name="chat" [size]="15" class="mr-1.5 align-middle" />{{ c.title }} ({{ c.messages.length }} tin)</p>
                <button type="button" class="text-xs text-slate-400 hover:text-slate-700" (click)="conversation.set(null)">Đóng</button>
              </div>
              @if (c.messages.length === 0) {
                <p class="text-xs text-slate-400">Chưa nhắn tin.</p>
              }
              <div class="max-h-96 space-y-1.5 overflow-y-auto rounded-lg bg-slate-50 p-3">
                @for (m of c.messages; track m.id) {
                  <div class="flex" [class.justify-end]="m.senderId === u.user.id">
                    <div class="max-w-[80%] whitespace-pre-wrap break-words rounded-xl px-3 py-1.5 text-xs" [class]="m.senderId === u.user.id ? 'bg-brand-100 text-brand-900' : 'bg-white text-slate-700'">
                      {{ m.body }}
                      <span class="block text-right text-[10px] text-slate-400">{{ m.createdAt | date: 'dd/MM HH:mm' }}{{ m.readAt ? ' · đã xem' : '' }}</span>
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        </section>

        <!-- Báo cáo về người này -->
        <section class="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 class="mb-3 text-sm font-semibold text-slate-700">Bị báo cáo ({{ a.reports.length }})</h2>
          @if (a.reports.length === 0) {
            <p class="text-xs text-slate-400">Chưa ai báo cáo người này.</p>
          }
          <div class="space-y-2">
            @for (r of a.reports; track r.id) {
              <div class="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <div class="flex flex-wrap items-center gap-2 text-xs">
                  <span class="rounded bg-rose-50 px-2 py-0.5 font-medium text-rose-700">{{ reasonLabel(r.reason) }}</span>
                  <span class="text-slate-500">{{ r.createdAt | date: 'dd/MM/yyyy HH:mm' }}</span>
                  <span [class]="r.status === 'OPEN' ? 'font-semibold text-amber-700' : 'text-slate-400'">{{ r.status === 'OPEN' ? 'Chưa xử lý' : 'Đã xử lý' }}</span>
                  <span class="text-slate-500">· bởi <a [routerLink]="['/admin/users', r.reporter.id]" class="font-medium text-brand-700 hover:underline">{{ r.reporter.displayName }}</a></span>
                </div>
                @if (r.note) {
                  <p class="mt-1 whitespace-pre-line text-slate-600">{{ r.note }}</p>
                }
              </div>
            }
          </div>
          @if (a.reports.length) {
            <a routerLink="/admin/users" [queryParams]="{ tab: 'reports' }" class="mt-3 inline-block text-xs font-medium text-brand-700 hover:underline">Xử lý ở tab Báo cáo →</a>
          }
        </section>
      } @else {
        <p class="text-sm text-slate-500">Đang tải…</p>
      }
    </div>
  `,
})
export class AdminUserDetailPage {
  private readonly dating = inject(DatingService);
  private readonly toast = inject(ToastService);

  /** Từ đường dẫn /admin/users/:id */
  readonly id = input.required<string>();

  protected readonly data = signal<DatingActivity | null>(null);
  protected readonly notFound = signal(false);
  protected readonly busy = signal(false);
  protected readonly conversation = signal<{ title: string; messages: ChatMessage[] } | null>(null);

  constructor() {
    // Đổi người (bấm tên khác trong trang): tải lại
    effect(() => {
      const id = this.id();
      untracked(() => void this.load(id));
    });
  }

  protected tiles(a: DatingActivity) {
    return [
      { label: 'Quán đã lưu', value: a.detail.savedPlaces, alert: false },
      { label: 'Chỗ chơi đã lưu', value: a.detail.savedSpots, alert: false },
      { label: 'Plan', value: a.detail.plans, alert: false },
      { label: 'Đã thích', value: a.summary.likesGiven, alert: false },
      { label: 'Được thích', value: a.summary.likesReceived, alert: false },
      { label: 'Match', value: a.summary.matches, alert: false },
      { label: 'Bị báo cáo', value: a.summary.reportsAgainst, alert: a.summary.reportsAgainst > 0 },
    ];
  }

  protected columns(a: DatingActivity) {
    return [
      { title: 'Đã thích', items: a.likesGiven },
      { title: 'Được thích bởi', items: a.likesReceived },
      { title: 'Match', items: a.matches },
    ];
  }

  protected statusOf(status: DatingStatus) {
    return DATING_STATUSES.find((s) => s.value === status) ?? DATING_STATUSES[1];
  }

  protected genderLabel(value: string | null): string {
    return GENDERS.find((g) => g.value === value)?.label ?? '—';
  }

  protected reasonLabel(reason: ReportReason): string {
    return REPORT_REASONS.find((r) => r.value === reason)?.label ?? reason;
  }

  protected initial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || '?';
  }

  /** "2000-05-20" → số tuổi hôm nay */
  protected age(birthday: string): number {
    const b = new Date(birthday);
    const now = new Date();
    let years = now.getFullYear() - b.getFullYear();
    if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) years--;
    return years;
  }

  protected async openConversation(matchId: string, otherName: string): Promise<void> {
    const a = this.data();
    if (!a) return;
    const messages = await this.dating.adminMessages(matchId);
    this.conversation.set({ title: `${a.summary.user.displayName} ↔ ${otherName}`, messages });
  }

  protected async setBan(banned: boolean): Promise<void> {
    const a = this.data();
    if (!a || this.busy()) return;
    this.busy.set(true);
    try {
      await this.dating.ban(a.summary.user.id, banned);
      this.toast.success(banned ? `Đã khoá ${a.summary.user.displayName} khỏi Tìm đối tượng.` : `Đã mở khoá ${a.summary.user.displayName}.`);
      await this.load(a.summary.user.id);
    } finally {
      this.busy.set(false);
    }
  }

  private async load(id: string): Promise<void> {
    this.conversation.set(null);
    this.notFound.set(false);
    try {
      this.data.set(await this.dating.adminActivity(id));
    } catch {
      this.data.set(null);
      this.notFound.set(true);
    }
  }
}
