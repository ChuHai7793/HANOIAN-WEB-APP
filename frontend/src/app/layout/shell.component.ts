import { Component, computed, ElementRef, HostListener, inject, signal, viewChild } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PlaceService } from '../core/services/place.service';
import { GirlfriendService } from '../core/services/girlfriend.service';
import { MatchInboxService } from '../core/services/match-inbox.service';
import { DataBootstrapService } from '../core/services/data-bootstrap.service';
import { AuthService } from '../core/auth/auth.service';
import { LegacyImportDialogComponent } from '../shared/ui/legacy-import-dialog.component';
import { ConfirmDialogComponent } from '../shared/ui/confirm-dialog.component';
import { IconComponent, IconName } from '../shared/ui/icon.component';
import { SavedSpotService } from '../core/services/saved-spot.service';
import { DateVibeService } from '../core/services/date-vibe.service';

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

const COLLAPSED_KEY = 'gfm.sidebarCollapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LegacyImportDialogComponent, IconComponent, ConfirmDialogComponent],
  template: `
    <!-- data-collapsed: thanh bên thu gọn (chỉ logo + icon), chỉ áp dụng màn rộng (lg:); điện thoại vẫn là menu trượt -->
    <div class="group/shell flex min-h-screen" [attr.data-collapsed]="collapsed() ? '' : null">
      <!-- Sidebar -->
      <aside
        class="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-[width,transform] duration-200 lg:translate-x-0 lg:group-data-collapsed/shell:w-[72px]"
        [class.-translate-x-full]="!menuOpen()"
      >
        <!-- Nút tròn nằm đè lên mép phải thanh bên, ngang logo: thu gọn / mở rộng (chỉ màn rộng) -->
        <button
          type="button"
          class="group/toggle absolute -right-3 top-9 z-10 hidden h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition hover:border-brand-300 hover:text-brand-600 hover:shadow lg:flex"
          [attr.aria-label]="collapsed() ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'"
          [title]="collapsed() ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'"
          (click)="toggleCollapsed()"
        >
          <span class="transition-transform duration-200" [class.rotate-180]="collapsed()"><app-icon name="chevronLeft" [size]="14" [stroke]="2.5" /></span>
        </button>

        <div class="flex shrink-0 items-center gap-3 px-6 pb-2 pt-6 lg:group-data-collapsed/shell:justify-center lg:group-data-collapsed/shell:px-0">
          <img src="logo.png" alt="" class="h-11 w-auto" />
          <div class="flex min-w-0 flex-1 flex-col gap-0.5 lg:group-data-collapsed/shell:hidden">
            <span class="text-xl font-extrabold leading-none tracking-wide text-slate-900">HANOI<span class="text-brand-600">VIBE</span></span>
            <span class="text-xs text-slate-500">Hẹn ở đâu cũng đẹp</span>
          </div>
        </div>

        <!-- Menu dài hơn màn hình thì cuộn trong phần này, không chui xuống dưới khối tài khoản -->
        <nav class="min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-4 py-4 lg:group-data-collapsed/shell:px-3" aria-label="Điều hướng chính">
          @for (section of sections(); track section.title) {
            @if (section.title) {
              <p class="px-3 pb-1.5 pt-5 text-[11px] font-bold uppercase tracking-wider text-slate-500 lg:group-data-collapsed/shell:hidden">
                {{ section.title }}
              </p>
              <!-- Thu gọn: thay tiêu đề nhóm bằng một vạch ngăn -->
              <hr class="mx-2 my-3 hidden border-slate-200 lg:group-data-collapsed/shell:block" />
            }
            @for (item of section.items; track item.path) {
              <a
                [routerLink]="item.path"
                routerLinkActive="!bg-brand-100 !text-brand-800 font-semibold"
                class="relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] text-slate-700 transition hover:bg-slate-50 lg:group-data-collapsed/shell:justify-center lg:group-data-collapsed/shell:px-0"
                [attr.title]="collapsed() ? item.label : null"
                [attr.aria-label]="item.label"
                (click)="menuOpen.set(false)"
              >
                <app-icon [name]="item.icon" />
                <span class="flex-1 truncate lg:group-data-collapsed/shell:hidden">{{ item.label }}</span>
                @if (item.alert && item.alert() > 0) {
                  <span class="rounded-full bg-[#C2335F] px-2 py-0.5 text-[11px] font-bold text-white lg:group-data-collapsed/shell:hidden">{{ item.alert() }} mới</span>
                  <!-- Thu gọn: chấm đỏ ở góc icon -->
                  <span class="absolute right-2.5 top-2 hidden h-2.5 w-2.5 rounded-full bg-[#C2335F] ring-2 ring-white lg:group-data-collapsed/shell:block"></span>
                }
                @if (item.badge && auth.isLoggedIn()) {
                  <span class="min-w-6 rounded-full bg-brand-100 px-1.5 py-0.5 text-center text-xs font-semibold text-brand-800 lg:group-data-collapsed/shell:hidden">
                    {{ item.badge() }}
                  </span>
                }
              </a>
            }
          }
        </nav>

        <div #account class="relative mx-4 shrink-0 border-t border-slate-200 bg-white px-1 py-3 lg:group-data-collapsed/shell:mx-3 lg:group-data-collapsed/shell:px-0">
          @if (auth.user(); as user) {
            <!-- Một dòng tài khoản; bấm mở menu (Hồ sơ, Đăng xuất, Đăng xuất mọi thiết bị) -->
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-xl p-1.5 text-left transition hover:bg-slate-50 lg:group-data-collapsed/shell:justify-center"
              [class.bg-slate-50]="accountOpen()"
              [attr.aria-expanded]="accountOpen()"
              aria-haspopup="menu"
              [title]="collapsed() ? user.displayName : ''"
              (click)="accountOpen.set(!accountOpen())"
            >
              @if (user.avatarUrl) {
                <img [src]="user.avatarUrl" alt="" class="h-9 w-9 shrink-0 rounded-full object-cover" />
              } @else {
                <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-200 text-sm font-bold text-brand-800">
                  {{ initial(user.displayName) }}
                </span>
              }
              <span class="min-w-0 flex-1 lg:group-data-collapsed/shell:hidden">
                <span class="flex items-center gap-1.5">
                  <span class="truncate text-sm font-semibold text-slate-900">{{ user.displayName }}</span>
                  @if (user.role === 'ADMIN') {
                    <span class="shrink-0 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">Admin</span>
                  } @else {
                    <span class="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">Chỉ xem</span>
                  }
                </span>
                <span class="block truncate text-xs text-slate-500">{{ user.username ? '@' + user.username : user.email }}</span>
              </span>
              <span class="text-slate-400 lg:group-data-collapsed/shell:hidden"><app-icon name="more" [size]="18" /></span>
            </button>

            @if (accountOpen()) {
              <div
                role="menu"
                class="absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg lg:group-data-collapsed/shell:bottom-0 lg:group-data-collapsed/shell:left-full lg:group-data-collapsed/shell:right-auto lg:group-data-collapsed/shell:mb-0 lg:group-data-collapsed/shell:ml-3 lg:group-data-collapsed/shell:w-60"
              >
                <!-- Thu gọn: menu mở sang phải, thêm tên để biết đang ở tài khoản nào -->
                <p class="hidden truncate border-b border-slate-100 px-4 pb-2 pt-1 text-sm font-semibold text-slate-900 lg:group-data-collapsed/shell:block">{{ user.displayName }}</p>
                <a
                  routerLink="/profile"
                  role="menuitem"
                  class="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                  (click)="accountOpen.set(false); menuOpen.set(false)"
                >
                  <app-icon name="user" [size]="18" />Hồ sơ của tôi
                </a>
                <button
                  type="button"
                  role="menuitem"
                  class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                  (click)="accountOpen.set(false); auth.logout()"
                >
                  <app-icon name="logout" [size]="18" />Đăng xuất
                </button>
                <div class="my-1.5 border-t border-slate-100"></div>
                <button
                  type="button"
                  role="menuitem"
                  class="flex w-full items-center gap-3 px-4 py-2 text-left text-[13px] text-rose-600 transition hover:bg-rose-50"
                  (click)="accountOpen.set(false); confirmLogoutAll.set(true)"
                >
                  <app-icon name="logout" [size]="16" />Đăng xuất mọi thiết bị
                </button>
              </div>
            }
          } @else {
            <!-- Khách: mời tạo tài khoản để lưu quán, lập plan, hẹn hò -->
            <p class="mb-3 text-xs text-slate-500 lg:group-data-collapsed/shell:hidden">Tạo tài khoản miễn phí để lưu quán, lập plan và tìm người hẹn hò.</p>
            <!-- Thu gọn: còn một icon đăng nhập -->
            <a
              routerLink="/login"
              class="mx-auto hidden h-11 w-11 items-center justify-center rounded-xl text-brand-700 transition hover:bg-brand-50 lg:group-data-collapsed/shell:flex"
              title="Đăng nhập / Đăng ký"
              aria-label="Đăng nhập"
            >
              <app-icon name="login" />
            </a>
            <div class="flex gap-2 lg:group-data-collapsed/shell:hidden">
              <a
                routerLink="/register"
                class="flex min-h-10 flex-1 items-center justify-center rounded-[10px] bg-brand-600 px-3 text-[13px] font-semibold text-white transition hover:bg-brand-700"
                (click)="menuOpen.set(false)"
              >
                Đăng ký
              </a>
              <a
                routerLink="/login"
                class="flex min-h-10 flex-1 items-center justify-center rounded-[10px] border border-brand-200 bg-white px-3 text-[13px] font-semibold text-slate-700 transition hover:bg-brand-50"
                (click)="menuOpen.set(false)"
              >
                Đăng nhập
              </a>
            </div>
          }
        </div>
      </aside>

      @if (confirmLogoutAll()) {
        <app-confirm-dialog
          title="Đăng xuất mọi thiết bị?"
          message="Tài khoản sẽ bị đăng xuất trên tất cả điện thoại, máy tính đang đăng nhập, kể cả máy này. Dùng khi bạn nghi ngờ người khác đang dùng tài khoản của mình."
          confirmLabel="Đăng xuất tất cả"
          (confirm)="confirmLogoutAll.set(false); auth.logoutAll()"
          (cancel)="confirmLogoutAll.set(false)"
        />
      }

      @if (menuOpen()) {
        <div
          class="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          (click)="menuOpen.set(false)"
        ></div>
      }

      <!-- Nội dung: sidebar đã fixed nên chừa lề trái bằng đúng bề rộng của nó -->
      <div class="flex min-w-0 flex-1 flex-col transition-[margin] duration-200 lg:ml-64 lg:group-data-collapsed/shell:ml-[72px]">
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
  /** Đồng bộ kết quả quiz Gu hẹn hò lên tài khoản khi đăng nhập */
  private readonly dateVibe = inject(DateVibeService);
  private readonly places = inject(PlaceService);
  private readonly girlfriends = inject(GirlfriendService);
  /** Chỗ chơi đã lưu: tính chung vào số của My place */
  private readonly savedSpots = inject(SavedSpotService);
  /** Mở kết nối realtime khi vào app và giữ số tin chưa đọc cho menu */
  private readonly inbox = inject(MatchInboxService);

  protected readonly menuOpen = signal(false);
  /** Menu tài khoản (cuối thanh bên) */
  protected readonly accountOpen = signal(false);
  protected readonly confirmLogoutAll = signal(false);
  private readonly account = viewChild<ElementRef<HTMLElement>>('account');

  /** Bấm ra ngoài khối tài khoản hoặc nhấn Esc thì đóng menu tài khoản */
  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (this.accountOpen() && !this.account()?.nativeElement.contains(event.target as Node)) this.accountOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.accountOpen.set(false);
  }
  /** Thanh bên thu gọn (màn rộng): nhớ theo trình duyệt */
  protected readonly collapsed = signal(readCollapsed());

  protected toggleCollapsed(): void {
    this.collapsed.update((v) => !v);
    try {
      localStorage.setItem(COLLAPSED_KEY, this.collapsed() ? '1' : '0');
    } catch {
      // Chế độ ẩn danh / chặn lưu trữ: chỉ không nhớ được lựa chọn
    }
  }
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
        { path: '/quiz', label: 'Gu hẹn hò', icon: 'smile' },
        { path: '/cam-nang', label: 'Cẩm nang', icon: 'book' },
        { path: '/places', label: 'My place', icon: 'bookmark', badge: () => this.places.items().length + this.savedSpots.count() },
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
              { path: '/admin/articles', label: 'Bài viết', icon: 'edit' },
            ],
          } satisfies NavSection,
        ]
      : []),
  ]);
}
