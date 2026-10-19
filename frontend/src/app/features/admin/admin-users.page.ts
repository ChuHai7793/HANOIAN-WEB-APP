import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  DATING_STATUSES,
  DatingReport,
  DatingStats,
  DatingStatus,
  DatingUserRow,
  REPORT_REASONS,
  ReportReason,
} from '../../core/models/dating.model';
import { DatingService } from '../../core/services/dating.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared/ui/icon.component';

type Tab = 'users' | 'reports';

/**
 * Chỉ admin: trang "Người dùng". Thống kê, mọi tài khoản kèm trạng thái Tìm đối tượng (lọc, tìm), báo cáo
 * (xử lý, khoá người bị báo cáo). Bấm một người: sang trang chi tiết /admin/users/:id.
 */
@Component({
  selector: 'app-admin-users-page',
  imports: [DatePipe, IconComponent, RouterLink],
  template: `
    <div class="p-4 sm:p-5 lg:p-6">
      <div class="mb-6">
        <h1 class="flex items-center gap-2 text-xl font-bold text-slate-900"><span class="text-brand-600"><app-icon name="users" [size]="24" /></span> Người dùng</h1>
        <p class="mt-1 text-sm text-slate-500">Mọi tài khoản đã đăng ký, trạng thái Tìm đối tượng, báo cáo, khoá / mở khoá</p>
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
        <button type="button" class="min-h-10 flex-1 rounded-md px-3 font-medium sm:flex-none" [class]="tab() === 'users' ? 'bg-white shadow-sm' : 'text-slate-500'" (click)="setTab('users')"><app-icon name="users" [size]="14" class="mr-1.5 align-middle" />Người dùng</button>
        <button type="button" class="min-h-10 flex-1 rounded-md px-3 font-medium sm:flex-none" [class]="tab() === 'reports' ? 'bg-white shadow-sm' : 'text-slate-500'" (click)="setTab('reports')">
          <app-icon name="flag" [size]="14" class="mr-1.5 align-middle" />Báo cáo
          @if (stats()?.openReports) {
            <span class="ml-1 rounded-full bg-rose-100 px-1.5 text-xs font-semibold text-rose-700">{{ stats()?.openReports }}</span>
          }
        </button>
      </div>

      @if (tab() === 'users') {
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <input
            type="search"
            [value]="search()"
            (input)="search.set($any($event.target).value)"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 sm:w-64"
            placeholder="Tìm theo tên, email, thành phố…"
          />
          <div class="flex flex-wrap gap-1.5 text-xs">
            <button type="button" class="min-h-9 rounded-full px-3" [class]="filter() === '' ? 'bg-brand-100 font-semibold text-brand-700' : 'bg-slate-100 text-slate-600'" (click)="filter.set('')">Tất cả · {{ users().length }}</button>
            @for (st of statuses; track st.value) {
              <button type="button" class="min-h-9 rounded-full px-3" [class]="filter() === st.value ? 'bg-brand-100 font-semibold text-brand-700' : 'bg-slate-100 text-slate-600'" (click)="filter.set(st.value)">{{ st.label }} · {{ countOf(st.value) }}</button>
            }
          </div>
        </div>

        @if (loading()) {
          <p class="text-sm text-slate-500">Đang tải…</p>
        } @else if (filtered().length === 0) {
          <p class="text-sm text-slate-500">Không có người dùng nào.</p>
        } @else {
          <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table class="w-full text-left text-sm">
              <thead class="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th class="px-3 py-2">Người dùng</th>
                  <th class="px-3 py-2 max-md:hidden">Đăng ký</th>
                  <th class="px-3 py-2">Tìm đối tượng</th>
                  <th class="px-3 py-2 text-right max-md:hidden">Đã thích</th>
                  <th class="px-3 py-2 text-right max-md:hidden">Được thích</th>
                  <th class="px-3 py-2 text-right">Match</th>
                  <th class="px-3 py-2 text-right max-md:hidden">Bị báo cáo</th>
                  <th class="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                @for (u of filtered(); track u.user.id) {
                  <tr class="cursor-pointer border-t border-slate-100 hover:bg-brand-50/40" (click)="open(u.user.id)">
                    <td class="px-3 py-2">
                      <a [routerLink]="['/admin/users', u.user.id]" class="flex items-center gap-2.5" (click)="$event.stopPropagation()">
                        @if (u.user.avatarUrl) {
                          <img [src]="u.user.avatarUrl" alt="" class="h-8 w-8 shrink-0 rounded-full object-cover" loading="lazy" />
                        } @else {
                          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">{{ initial(u.user.displayName) }}</span>
                        }
                        <span class="min-w-0">
                          <span class="block truncate font-medium text-brand-700 hover:underline">
                            {{ u.user.displayName }}
                            @if (u.role === 'ADMIN') {
                              <span class="ml-1 rounded bg-brand-100 px-1.5 py-0.5 text-xs font-medium text-brand-700">Admin</span>
                            }
                          </span>
                          <span class="block truncate text-xs text-slate-400">{{ u.username || u.user.email }}{{ u.city ? ' · ' + u.city : '' }}</span>
                        </span>
                      </a>
                    </td>
                    <td class="whitespace-nowrap px-3 py-2 text-xs text-slate-500 max-md:hidden">{{ u.createdAt | date: 'dd/MM/yyyy' }}</td>
                    <td class="px-3 py-2"><span class="whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium" [class]="statusOf(u.status).tone">{{ statusOf(u.status).label }}</span></td>
                    <td class="px-3 py-2 text-right max-md:hidden">{{ u.likesGiven }}</td>
                    <td class="px-3 py-2 text-right max-md:hidden">{{ u.likesReceived }}</td>
                    <td class="px-3 py-2 text-right">{{ u.matches }}</td>
                    <td class="px-3 py-2 text-right max-md:hidden" [class.text-rose-600]="u.reportsAgainst > 0">{{ u.reportsAgainst }}</td>
                    <td class="px-3 py-2 text-right text-slate-400"><app-icon name="arrowRight" [size]="14" /></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      } @else {
        <div class="mb-3 flex gap-2 text-xs">
          <button type="button" class="min-h-9 rounded-full px-3" [class]="reportStatus() === 'OPEN' ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'" (click)="loadReports('OPEN')">Chưa xử lý</button>
          <button type="button" class="min-h-9 rounded-full px-3" [class]="reportStatus() === 'RESOLVED' ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'" (click)="loadReports('RESOLVED')">Đã xử lý</button>
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
                  <a [routerLink]="['/admin/users', r.reporter.id]" class="font-semibold text-slate-900 hover:underline">{{ r.reporter.displayName }}</a> ({{ r.reporter.email }}) báo cáo
                  <a [routerLink]="['/admin/users', r.reported.id]" class="font-semibold text-brand-700 hover:underline">{{ r.reported.displayName }}</a>
                  ({{ r.reported.email }})
                </p>
                @if (r.note) {
                  <p class="mt-1 whitespace-pre-line rounded-lg bg-slate-50 px-3 py-2 text-slate-600">{{ r.note }}</p>
                }
                <div class="mt-3 flex flex-wrap gap-2 text-xs">
                  @if (r.status === 'OPEN') {
                    <button type="button" class="min-h-9 rounded-lg border border-slate-200 px-3 hover:bg-slate-50" (click)="resolve(r, 'RESOLVED')"><app-icon name="check" [size]="14" class="mr-1.5 align-middle" />Đánh dấu đã xử lý</button>
                  } @else {
                    <button type="button" class="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50" (click)="resolve(r, 'OPEN')"><app-icon name="refresh" [size]="14" class="mr-1.5 align-middle" />Mở lại</button>
                  }
                  <button type="button" class="rounded-lg bg-rose-600 px-3 py-1.5 font-semibold text-white hover:bg-rose-700" (click)="ban(r.reported.id, r.reported.displayName)"><app-icon name="ban" [size]="14" class="mr-1.5 align-middle" />Khoá {{ r.reported.displayName }}</button>
                </div>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
})
export class AdminUsersPage implements OnInit {
  private readonly dating = inject(DatingService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly statuses = DATING_STATUSES;
  protected readonly tab = signal<Tab>('users');
  protected readonly stats = signal<DatingStats | null>(null);
  protected readonly users = signal<DatingUserRow[]>([]);
  protected readonly loading = signal(true);
  protected readonly search = signal('');
  protected readonly filter = signal<DatingStatus | ''>('');
  protected readonly reportStatus = signal<'OPEN' | 'RESOLVED'>('OPEN');
  protected readonly reports = signal<DatingReport[]>([]);

  protected readonly filtered = computed(() => {
    const keyword = this.search().trim().toLowerCase();
    const status = this.filter();
    return this.users().filter(
      (u) =>
        (!status || u.status === status) &&
        (!keyword ||
          [u.user.displayName, u.user.email, u.username, u.city].some((s) => s?.toLowerCase().includes(keyword))),
    );
  });

  async ngOnInit(): Promise<void> {
    // Quay lại từ trang chi tiết bằng link "Báo cáo": mở đúng tab
    if (this.route.snapshot.queryParamMap.get('tab') === 'reports') this.setTab('reports');
    await Promise.all([this.refreshStats(), this.loadUsers()]);
  }

  protected statTiles(s: DatingStats) {
    return [
      { label: 'Tổng người dùng', value: s.totalUsers, alert: false },
      { label: 'Đang bật Tìm đối tượng', value: s.enabledUsers, alert: false },
      { label: 'Hồ sơ thiếu', value: s.incompleteProfiles, alert: false },
      { label: 'Chưa có hồ sơ', value: s.noProfile, alert: false },
      { label: 'Match', value: s.matches, alert: false },
      { label: 'Báo cáo chờ xử lý', value: s.openReports, alert: s.openReports > 0 },
    ];
  }

  protected countOf(status: DatingStatus): number {
    return this.users().filter((u) => u.status === status).length;
  }

  protected statusOf(status: DatingStatus) {
    return DATING_STATUSES.find((s) => s.value === status) ?? DATING_STATUSES[1];
  }

  protected initial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || '?';
  }

  protected reasonLabel(reason: ReportReason): string {
    return REPORT_REASONS.find((r) => r.value === reason)?.label ?? reason;
  }

  protected setTab(tab: Tab): void {
    this.tab.set(tab);
    if (tab === 'reports') void this.loadReports(this.reportStatus());
  }

  protected open(userId: string): void {
    void this.router.navigate(['/admin/users', userId]);
  }

  protected async loadReports(status: 'OPEN' | 'RESOLVED'): Promise<void> {
    this.reportStatus.set(status);
    this.reports.set(await this.dating.adminReports(status));
  }

  protected async resolve(r: DatingReport, status: 'OPEN' | 'RESOLVED'): Promise<void> {
    await this.dating.resolveReport(r.id, status);
    await Promise.all([this.loadReports(this.reportStatus()), this.refreshStats()]);
  }

  protected async ban(userId: string, name: string): Promise<void> {
    await this.dating.ban(userId, true);
    this.toast.success(`Đã khoá ${name} khỏi Tìm đối tượng.`);
    await Promise.all([this.refreshStats(), this.loadUsers()]);
  }

  private async loadUsers(): Promise<void> {
    try {
      this.users.set(await this.dating.adminUsers());
    } finally {
      this.loading.set(false);
    }
  }

  private async refreshStats(): Promise<void> {
    this.stats.set(await this.dating.adminStats());
  }
}
