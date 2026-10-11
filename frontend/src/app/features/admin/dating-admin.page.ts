import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import {
  ChatMessage,
  DatingActivity,
  DatingReport,
  DatingStats,
  DatingUserRow,
  REPORT_REASONS,
  ReportReason,
} from '../../core/models/dating.model';
import { DatingService } from '../../core/services/dating.service';
import { ToastService } from '../../core/services/toast.service';

type Tab = 'reports' | 'users';

/**
 * Chỉ admin: quản trị "Tìm đối tượng". Thống kê, báo cáo (xử lý, khoá người bị báo cáo), danh sách người
 * dùng có hoạt động, xem ai thích ai và các match của từng người, khoá / mở khoá.
 */
@Component({
  selector: 'app-dating-admin-page',
  imports: [DatePipe],
  template: `
    <div class="p-4 sm:p-6 lg:p-8">
      <div class="mb-6">
        <h1 class="flex items-center gap-2 text-2xl font-bold text-slate-900"><span>💘</span> Quản trị Tìm đối tượng</h1>
        <p class="mt-1 text-sm text-slate-500">Báo cáo, hoạt động của người dùng, khoá / mở khoá</p>
      </div>

      @if (stats(); as s) {
        <div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          @for (t of statTiles(s); track t.label) {
            <div class="rounded-xl border border-slate-200 bg-white p-3">
              <p class="text-xs text-slate-500">{{ t.label }}</p>
              <p class="text-xl font-bold" [class]="t.alert ? 'text-rose-600' : 'text-slate-900'">{{ t.value }}</p>
            </div>
          }
        </div>
      }

      <div class="mb-4 flex rounded-lg bg-slate-100 p-1 text-sm sm:inline-flex">
        <button type="button" class="rounded-md px-3 py-1.5 font-medium" [class]="tab() === 'reports' ? 'bg-white shadow-sm' : 'text-slate-500'" (click)="tab.set('reports')">🚩 Báo cáo</button>
        <button type="button" class="rounded-md px-3 py-1.5 font-medium" [class]="tab() === 'users' ? 'bg-white shadow-sm' : 'text-slate-500'" (click)="openUsers()">👥 Người dùng</button>
      </div>

      @if (tab() === 'reports') {
        <div class="mb-3 flex gap-2 text-xs">
          <button type="button" class="rounded-full px-3 py-1" [class]="reportStatus() === 'OPEN' ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'" (click)="loadReports('OPEN')">Chưa xử lý</button>
          <button type="button" class="rounded-full px-3 py-1" [class]="reportStatus() === 'RESOLVED' ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'" (click)="loadReports('RESOLVED')">Đã xử lý</button>
        </div>
        @if (reports().length === 0) {
          <p class="text-sm text-slate-500">Không có báo cáo nào.</p>
        } @else {
          <div class="space-y-3">
            @for (r of reports(); track r.id) {
              <div class="rounded-xl border border-slate-200 bg-white p-4 text-sm">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="rounded bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">{{ reasonLabel(r.reason) }}</span>
                  <span class="text-slate-500">{{ r.createdAt | date: 'dd/MM/yyyy HH:mm' }}</span>
                </div>
                <p class="mt-2 text-slate-700">
                  <strong>{{ r.reporter.displayName }}</strong> ({{ r.reporter.email }}) báo cáo
                  <button type="button" class="font-semibold text-brand-700 hover:underline" (click)="openActivity(r.reported.id)">{{ r.reported.displayName }}</button>
                  ({{ r.reported.email }})
                </p>
                @if (r.note) {
                  <p class="mt-1 whitespace-pre-line rounded-lg bg-slate-50 px-3 py-2 text-slate-600">{{ r.note }}</p>
                }
                <div class="mt-3 flex flex-wrap gap-2 text-xs">
                  @if (r.status === 'OPEN') {
                    <button type="button" class="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50" (click)="resolve(r, 'RESOLVED')">✓ Đánh dấu đã xử lý</button>
                  } @else {
                    <button type="button" class="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50" (click)="resolve(r, 'OPEN')">↺ Mở lại</button>
                  }
                  <button type="button" class="rounded-lg bg-rose-600 px-3 py-1.5 font-semibold text-white hover:bg-rose-700" (click)="setBan(r.reported.id, r.reported.displayName, true)">🚫 Khoá {{ r.reported.displayName }}</button>
                </div>
              </div>
            }
          </div>
        }
      } @else {
        @if (users().length === 0) {
          <p class="text-sm text-slate-500">Chưa có ai dùng Tìm đối tượng.</p>
        } @else {
          <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table class="w-full text-left text-sm">
              <thead class="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th class="px-3 py-2">Người dùng</th>
                  <th class="px-3 py-2">Trạng thái</th>
                  <th class="px-3 py-2 text-right">Đã thích</th>
                  <th class="px-3 py-2 text-right">Được thích</th>
                  <th class="px-3 py-2 text-right">Match</th>
                  <th class="px-3 py-2 text-right">Bị báo cáo</th>
                  <th class="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                @for (u of users(); track u.user.id) {
                  <tr class="border-t border-slate-100">
                    <td class="px-3 py-2">
                      <button type="button" class="font-medium text-brand-700 hover:underline" (click)="openActivity(u.user.id)">{{ u.user.displayName }}</button>
                      <p class="text-xs text-slate-400">{{ u.user.email }}</p>
                    </td>
                    <td class="px-3 py-2 text-xs">{{ u.banned ? '🚫 Bị khoá' : u.enabled ? '✅ Đang bật' : 'Đã tắt' }}</td>
                    <td class="px-3 py-2 text-right">{{ u.likesGiven }}</td>
                    <td class="px-3 py-2 text-right">{{ u.likesReceived }}</td>
                    <td class="px-3 py-2 text-right">{{ u.matches }}</td>
                    <td class="px-3 py-2 text-right" [class.text-rose-600]="u.reportsAgainst > 0">{{ u.reportsAgainst }}</td>
                    <td class="px-3 py-2 text-right">
                      <button type="button" class="text-xs font-medium" [class]="u.banned ? 'text-emerald-700' : 'text-rose-600'" (click)="setBan(u.user.id, u.user.displayName, !u.banned)">
                        {{ u.banned ? 'Mở khoá' : 'Khoá' }}
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </div>

    @if (activity(); as a) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" (click)="activity.set(null)">
        <div class="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" (click)="$event.stopPropagation()">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-lg font-bold text-slate-900">{{ a.summary.user.displayName }}</h2>
              <p class="text-xs text-slate-500">{{ a.summary.user.email }} · {{ a.summary.banned ? 'Bị khoá' : a.summary.enabled ? 'Đang bật' : 'Đã tắt' }} · bị báo cáo {{ a.summary.reportsAgainst }} lần</p>
            </div>
            <button type="button" class="text-slate-400 hover:text-slate-700" (click)="activity.set(null)">✕</button>
          </div>
          <div class="mt-4 grid gap-4 sm:grid-cols-3">
            @for (col of activityColumns(a); track col.title) {
              <div>
                <p class="mb-2 text-sm font-semibold text-slate-700">{{ col.title }} ({{ col.items.length }})</p>
                @if (col.items.length === 0) {
                  <p class="text-xs text-slate-400">Không có</p>
                }
                <ul class="space-y-1.5">
                  @for (e of col.items; track e.user.id) {
                    <li class="text-xs">
                      <button type="button" class="font-medium text-brand-700 hover:underline" (click)="openActivity(e.user.id)">{{ e.user.displayName }}</button>
                      <span class="text-slate-400"> · {{ e.at | date: 'dd/MM HH:mm' }}</span>
                      @if (e.matchId) {
                        <button type="button" class="ml-1 text-brand-700 hover:underline" (click)="openConversation(a, e.matchId, e.user.displayName)">💬 Tin nhắn</button>
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
                <p class="text-sm font-semibold text-slate-700">💬 {{ c.title }} ({{ c.messages.length }} tin)</p>
                <button type="button" class="text-xs text-slate-400 hover:text-slate-700" (click)="conversation.set(null)">Đóng</button>
              </div>
              @if (c.messages.length === 0) {
                <p class="text-xs text-slate-400">Chưa nhắn tin.</p>
              }
              <div class="max-h-80 space-y-1.5 overflow-y-auto rounded-lg bg-slate-50 p-3">
                @for (m of c.messages; track m.id) {
                  <div class="flex" [class.justify-end]="m.senderId === c.ownerId">
                    <div class="max-w-[80%] whitespace-pre-wrap break-words rounded-xl px-3 py-1.5 text-xs" [class]="m.senderId === c.ownerId ? 'bg-brand-100 text-brand-900' : 'bg-white text-slate-700'">
                      {{ m.body }}
                      <span class="block text-right text-[10px] text-slate-400">{{ m.createdAt | date: 'dd/MM HH:mm' }}{{ m.readAt ? ' · đã xem' : '' }}</span>
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class DatingAdminPage implements OnInit {
  private readonly dating = inject(DatingService);
  private readonly toast = inject(ToastService);

  protected readonly tab = signal<Tab>('reports');
  protected readonly stats = signal<DatingStats | null>(null);
  protected readonly reportStatus = signal<'OPEN' | 'RESOLVED'>('OPEN');
  protected readonly reports = signal<DatingReport[]>([]);
  protected readonly users = signal<DatingUserRow[]>([]);
  protected readonly activity = signal<DatingActivity | null>(null);
  /** Cuộc trò chuyện đang xem; tin của người đang mở hoạt động (ownerId) nằm bên phải */
  protected readonly conversation = signal<{ title: string; ownerId: string; messages: ChatMessage[] } | null>(null);

  async ngOnInit(): Promise<void> {
    await Promise.all([this.refreshStats(), this.loadReports('OPEN')]);
  }

  protected statTiles(s: DatingStats) {
    return [
      { label: 'Đang bật', value: s.enabledUsers, alert: false },
      { label: 'Bị khoá', value: s.bannedUsers, alert: false },
      { label: 'Lượt quẹt', value: s.swipes, alert: false },
      { label: 'Lượt thích', value: s.likes, alert: false },
      { label: 'Match', value: s.matches, alert: false },
      { label: 'Báo cáo chờ xử lý', value: s.openReports, alert: s.openReports > 0 },
    ];
  }

  protected activityColumns(a: DatingActivity) {
    return [
      { title: '❤️ Đã thích', items: a.likesGiven },
      { title: '💌 Được thích bởi', items: a.likesReceived },
      { title: '💞 Match', items: a.matches },
    ];
  }

  protected reasonLabel(reason: ReportReason): string {
    return REPORT_REASONS.find((r) => r.value === reason)?.label ?? reason;
  }

  protected async loadReports(status: 'OPEN' | 'RESOLVED'): Promise<void> {
    this.reportStatus.set(status);
    this.reports.set(await this.dating.adminReports(status));
  }

  protected async openUsers(): Promise<void> {
    this.tab.set('users');
    this.users.set(await this.dating.adminUsers());
  }

  protected async openActivity(userId: string): Promise<void> {
    this.conversation.set(null);
    this.activity.set(await this.dating.adminActivity(userId));
  }

  protected async openConversation(a: DatingActivity, matchId: string, otherName: string): Promise<void> {
    const messages = await this.dating.adminMessages(matchId);
    this.conversation.set({ title: `${a.summary.user.displayName} ↔ ${otherName}`, ownerId: a.summary.user.id, messages });
  }

  protected async resolve(r: DatingReport, status: 'OPEN' | 'RESOLVED'): Promise<void> {
    await this.dating.resolveReport(r.id, status);
    await Promise.all([this.loadReports(this.reportStatus()), this.refreshStats()]);
  }

  protected async setBan(userId: string, name: string, banned: boolean): Promise<void> {
    await this.dating.ban(userId, banned);
    this.toast.success(banned ? `Đã khoá ${name} khỏi Tìm đối tượng.` : `Đã mở khoá ${name}.`);
    await this.refreshStats();
    if (this.tab() === 'users') this.users.set(await this.dating.adminUsers());
  }

  private async refreshStats(): Promise<void> {
    this.stats.set(await this.dating.adminStats());
  }
}
