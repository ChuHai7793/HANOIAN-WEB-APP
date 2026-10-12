import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PlaceService } from '../core/services/place.service';
import { GirlfriendService } from '../core/services/girlfriend.service';
import { MatchInboxService } from '../core/services/match-inbox.service';
import { DataBootstrapService } from '../core/services/data-bootstrap.service';
import { AuthService } from '../core/auth/auth.service';
import { LegacyImportDialogComponent } from '../shared/ui/legacy-import-dialog.component';
import { IconComponent, IconName } from '../shared/ui/icon.component';

interface NavSection {
  /** Rỗng: không có tiêu đề nhóm */
  title: string;
  items: NavItem[];
}

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  badge?: () => number;
  /** Số cần chú ý (tin chưa đọc): nền đỏ, ẩn khi bằng 0 */
  alert?: () => number;
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LegacyImportDialogComponent, IconComponent],
  template: `
    <div class="flex min-h-screen">
      <!-- Sidebar -->
      <aside
        class="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0"
        [class.-translate-x-full]="!menuOpen()"
      >
        <div class="flex shrink-0 items-center gap-3 px-6 pb-2 pt-6">
          <img src="logo.png" alt="" class="h-11 w-auto" />
          <div class="flex flex-col gap-0.5">
            <span class="text-xl font-extrabold leading-none tracking-wide text-slate-900">HANOI<span class="text-brand-600">VIBE</span></span>
            <span class="text-xs text-slate-500">Hẹn ở đâu cũng đẹp</span>
          </div>
        </div>

        <!-- Menu dài hơn màn hình thì cuộn trong phần này, không chui xuống dưới khối tài khoản -->
        <nav class="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-4" aria-label="Điều hướng chính">
          @for (section of sections(); track section.title) {
            @if (section.title) {
              <p class="px-3 pb-1.5 pt-5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {{ section.title }}
              </p>
            }
            @for (item of section.items; track item.path) {
              <a
                [routerLink]="item.path"
                routerLinkActive="!bg-brand-100 !text-brand-800 font-semibold"
                class="flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] text-slate-700 transition hover:bg-slate-50"
                (click)="menuOpen.set(false)"
              >
                <app-icon [name]="item.icon" />
                <span class="flex-1">{{ item.label }}</span>
                @if (item.alert && item.alert() > 0) {
                  <span class="rounded-full bg-[#C2335F] px-2 py-0.5 text-[11px] font-bold text-white">{{ item.alert() }} mới</span>
                }
                @if (item.badge) {
                  <span class="min-w-6 rounded-full bg-brand-100 px-1.5 py-0.5 text-center text-xs font-semibold text-brand-800">
                    {{ item.badge() }}
                  </span>
                }
              </a>
            }
          }
        </nav>

        <div class="mx-4 shrink-0 border-t border-slate-200 bg-white px-2 pb-6 pt-4">
          @if (auth.user(); as user) {
            <a
              routerLink="/profile"
              class="-m-1.5 flex items-center gap-3 rounded-lg p-1.5 transition hover:bg-slate-50"
              title="Hồ sơ của tôi"
              (click)="menuOpen.set(false)"
            >
              @if (user.avatarUrl) {
                <img [src]="user.avatarUrl" alt="" class="h-10 w-10 shrink-0 rounded-full object-cover" />
              } @else {
                <span
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-200 text-sm font-bold text-brand-800"
                >
                  {{ initial(user.displayName) }}
                </span>
              }
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold text-slate-900">
                  {{ user.displayName }}
                  @if (user.role === 'GUEST') {
                    <span class="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                      Chỉ xem
                    </span>
                  }
                </p>
                <p class="truncate text-xs text-slate-500">{{ user.username ? '@' + user.username : user.email }}</p>
              </div>
            </a>
            <div class="mt-3 flex gap-2">
              <button
                type="button"
                class="min-h-10 flex-1 rounded-[10px] border border-brand-200 bg-white px-3 text-[13px] font-semibold text-slate-700 transition hover:bg-brand-50"
                (click)="auth.logout()"
              >
                Đăng xuất
              </button>
              <button
                type="button"
                class="min-h-10 flex-1 rounded-[10px] border border-brand-200 bg-white px-3 text-[13px] text-slate-700 transition hover:bg-brand-50"
                title="Đăng xuất khỏi mọi thiết bị"
                (click)="auth.logoutAll()"
              >
                Mọi thiết bị
              </button>
            </div>
          }
        </div>
      </aside>

      @if (menuOpen()) {
        <div
          class="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          (click)="menuOpen.set(false)"
        ></div>
      }

      <!-- Nội dung: sidebar đã fixed nên chừa lề trái bằng đúng bề rộng của nó -->
      <div class="flex min-w-0 flex-1 flex-col lg:ml-64">
        <header
          class="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:hidden"
        >
          <button
            type="button"
            class="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            (click)="menuOpen.set(!menuOpen())"
            aria-label="Mở menu"
          >
            <app-icon name="menu" [size]="24" />
          </button>
          <img src="logo.png" alt="" class="h-8 w-auto" />
          <span class="font-extrabold tracking-wide text-slate-900">HANOI<span class="text-brand-600">VIBE</span></span>
        </header>

        <!-- Không đặt padding ở đây: từng trang tự lo, để vùng sticky bám sát mép trên -->
        <main class="flex-1">
          @if (bootstrap.status() === 'error') {
            <div
              class="mx-4 mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:mx-6 lg:mx-8"
            >
              <p class="flex-1">
                <strong>Không tải được dữ liệu từ server.</strong> Kiểm tra kết nối mạng hoặc thử lại
                sau ít phút.
              </p>
              <button
                type="button"
                class="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700"
                (click)="bootstrap.loadAll()"
              >
                Thử lại
              </button>
            </div>
          } @else if (bootstrap.status() === 'loading') {
            <p class="mx-4 mt-4 text-sm text-slate-500 sm:mx-6 lg:mx-8">Đang tải dữ liệu…</p>
          }
          <router-outlet />
        </main>
        <!-- Hỏi đưa dữ liệu localStorage của bản cũ lên tài khoản (chỉ hiện khi có) -->
        <app-legacy-import-dialog />
      </div>
    </div>
  `,
})
export class ShellComponent {
  private readonly places = inject(PlaceService);
  private readonly girlfriends = inject(GirlfriendService);
  /** Mở kết nối realtime khi vào app và giữ số tin chưa đọc cho menu */
  private readonly inbox = inject(MatchInboxService);

  protected readonly menuOpen = signal(false);
  protected readonly bootstrap = inject(DataBootstrapService);
  protected readonly auth = inject(AuthService);

  protected initial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || '?';
  }

  /**
   * Menu: Khám phá quán, Tìm chỗ chơi (danh mục chung) và My place (quán đã lưu của chính người
   * đăng nhập, lọc loại bằng chip trong trang) ở trên; nhóm "Quản trị" chỉ admin thấy.
   */
  protected readonly sections = computed<NavSection[]>(() => [
    {
      title: '',
      items: [
        { path: '/explore', label: 'Khám phá quán', icon: 'compass' },
        { path: '/spots', label: 'Tìm chỗ chơi', icon: 'gate' },
        { path: '/places', label: 'My place', icon: 'bookmark', badge: () => this.places.items().length },
        { path: '/dating', label: 'Tìm đối tượng', icon: 'heart', alert: () => this.inbox.unread() },
      ],
    },
    {
      title: 'Hẹn hò',
      items: [
        { path: '/girlfriends', label: 'Người yêu', icon: 'couple', badge: () => this.girlfriends.count() },
        { path: '/plans', label: 'Plan', icon: 'route' },
      ],
    },
    ...(this.auth.user()?.role === 'ADMIN'
      ? [
          {
            title: 'Quản trị',
            items: [
              { path: '/admin/users', label: 'Người dùng', icon: 'users' },
              { path: '/admin/dating', label: 'Tìm đối tượng', icon: 'shield' },
            ],
          } satisfies NavSection,
        ]
      : []),
  ]);
}
