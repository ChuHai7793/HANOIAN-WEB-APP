import { isPlatformBrowser } from '@angular/common';
import { Component, computed, DOCUMENT, effect, ElementRef, HostListener, inject, PLATFORM_ID, signal, viewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
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
import { OverlayHandle } from '../shared/ui/overlay';
import { ThemeService } from '../core/theme/theme.service';
import { AutoplanDialogComponent } from '../features/plans/autoplan-dialog.component';

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

/** Thanh tab dưới của điện thoại: 4 mục hay dùng nhất, mục cuối mở menu đầy đủ */
interface TabItem {
  path: string;
  label: string;
  icon: IconName;
  /** Icon tô đặc khi đang ở trang đó */
  fillable?: boolean;
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
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LegacyImportDialogComponent, IconComponent, ConfirmDialogComponent, AutoplanDialogComponent],
  template: `
    <!-- data-collapsed: thanh bên thu gọn (chỉ logo + icon), chỉ áp dụng màn rộng (lg:); điện thoại vẫn là menu trượt -->
    <div class="group/shell flex min-h-dvh" [attr.data-collapsed]="collapsed() ? '' : null">
      <!-- Sidebar -->
      <aside
        class="fixed inset-y-0 left-0 z-40 flex w-64 max-w-[85vw] flex-col border-r border-slate-200 bg-white transition-[width,transform] duration-200 lg:translate-x-0 lg:group-data-collapsed/shell:w-[72px]"
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
          <!-- Điện thoại: nút đóng menu trượt -->
          <button
            type="button"
            class="-mr-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 lg:hidden"
            aria-label="Đóng menu"
            (click)="menuOpen.set(false)"
          >
            <app-icon name="close" [size]="22" />
          </button>
        </div>

        <!-- Menu dài hơn màn hình thì cuộn trong phần này, không chui xuống dưới khối tài khoản -->
        <nav class="min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-4 lg:group-data-collapsed/shell:px-3" aria-label="Điều hướng chính">
          @for (section of sections(); track section.title) {
            @if (section.title) {
              <p class="px-3 pb-1.5 pt-5 text-xs font-bold uppercase tracking-wider text-slate-500 lg:group-data-collapsed/shell:hidden">
                {{ section.title }}
              </p>
              <!-- Thu gọn: thay tiêu đề nhóm bằng một vạch ngăn -->
              <hr class="mx-2 my-3 hidden border-slate-200 lg:group-data-collapsed/shell:block" />
            }
            @for (item of section.items; track item.path) {
              <a
                [routerLink]="item.path"
                routerLinkActive="!bg-brand-100 !text-brand-800 font-semibold"
                [routerLinkActiveOptions]="{ exact: item.path === '/' }"
                class="relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] text-slate-700 transition hover:bg-slate-50 lg:group-data-collapsed/shell:justify-center lg:group-data-collapsed/shell:px-0"
                [attr.title]="collapsed() ? item.label : null"
                [attr.aria-label]="item.label"
                (click)="menuOpen.set(false)"
              >
                <app-icon [name]="item.icon" />
                <span class="flex-1 truncate lg:group-data-collapsed/shell:hidden">{{ item.label }}</span>
                @if (item.alert && item.alert() > 0) {
                  <span class="rounded-full bg-[#C2335F] px-2 py-0.5 text-xs font-bold text-white lg:group-data-collapsed/shell:hidden">{{ item.alert() }} mới</span>
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

        <!-- Chế độ Sáng / Tối (nhớ theo trình duyệt) -->
        <div class="mx-4 shrink-0 px-1 pb-2 lg:group-data-collapsed/shell:mx-3 lg:group-data-collapsed/shell:px-0">
          <button
            type="button"
            class="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-[15px] text-slate-700 transition hover:bg-slate-50 lg:group-data-collapsed/shell:justify-center lg:group-data-collapsed/shell:px-0"
            [attr.aria-pressed]="theme.isDark()"
            [attr.title]="collapsed() ? (theme.isDark() ? 'Chuyển sang chế độ Sáng' : 'Chuyển sang chế độ Tối') : null"
            (click)="theme.toggle()"
          >
            <app-icon [name]="theme.isDark() ? 'sun' : 'moon'" />
            <span class="flex-1 text-left lg:group-data-collapsed/shell:hidden">{{ theme.isDark() ? 'Chế độ Sáng' : 'Chế độ Tối' }}</span>
            <span class="relative h-5 w-9 shrink-0 rounded-full transition lg:group-data-collapsed/shell:hidden" [class]="theme.isDark() ? 'bg-brand-600' : 'bg-slate-300'" aria-hidden="true">
              <span class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left]" [class]="theme.isDark() ? 'left-[18px]' : 'left-0.5'"></span>
            </span>
          </button>
        </div>

        <div
          #account
          class="relative mx-4 shrink-0 border-t border-slate-200 bg-white px-1 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:group-data-collapsed/shell:mx-3 lg:group-data-collapsed/shell:px-0"
        >
          @if (auth.user(); as user) {
            <!-- Một dòng tài khoản; bấm mở menu (Hồ sơ, Đăng xuất, Đăng xuất mọi thiết bị) -->
            <button
              type="button"
              class="flex min-h-12 w-full items-center gap-3 rounded-xl p-1.5 text-left transition hover:bg-slate-50 lg:group-data-collapsed/shell:justify-center"
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
                    <span class="shrink-0 rounded bg-brand-100 px-1.5 py-0.5 text-xs font-semibold text-brand-700">Admin</span>
                  } @else {
                    <span class="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">Chỉ xem</span>
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
                  class="flex min-h-11 items-center gap-3 px-4 text-sm text-slate-700 transition hover:bg-slate-50"
                  (click)="accountOpen.set(false); menuOpen.set(false)"
                >
                  <app-icon name="user" [size]="18" />Hồ sơ của tôi
                </a>
                <button
                  type="button"
                  role="menuitem"
                  class="flex min-h-11 w-full items-center gap-3 px-4 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                  (click)="accountOpen.set(false); auth.logout()"
                >
                  <app-icon name="logout" [size]="18" />Đăng xuất
                </button>
                <div class="my-1.5 border-t border-slate-100"></div>
                <button
                  type="button"
                  role="menuitem"
                  class="flex min-h-11 w-full items-center gap-3 px-4 text-left text-[13px] text-rose-600 transition hover:bg-rose-50"
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
                class="flex min-h-11 flex-1 items-center justify-center rounded-[10px] bg-brand-600 px-3 text-[13px] font-semibold text-white transition hover:bg-brand-700"
                (click)="menuOpen.set(false)"
              >
                Đăng ký
              </a>
              <a
                routerLink="/login"
                class="flex min-h-11 flex-1 items-center justify-center rounded-[10px] border border-brand-200 bg-white px-3 text-[13px] font-semibold text-slate-700 transition hover:bg-brand-50"
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

      <!-- Nội dung: sidebar đã fixed nên chừa lề trái bằng đúng bề rộng của nó; điện thoại chừa chỗ cho thanh tab dưới -->
      <div class="flex min-w-0 flex-1 flex-col pb-[var(--app-tabbar-h)] transition-[margin] duration-200 lg:ml-64 lg:group-data-collapsed/shell:ml-[72px]">
        <!-- Thanh trên cùng: điện thoại có nút menu + logo; màn rộng có ô tìm, chuông, Autoplan -->
        <header
          class="sticky top-0 z-30 flex h-[var(--app-header-h)] items-center gap-2 border-b border-slate-200 bg-white/95 pl-1.5 pr-3 backdrop-blur lg:px-6"
        >
          <button
            type="button"
            class="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 lg:hidden"
            (click)="menuOpen.set(!menuOpen())"
            aria-label="Mở menu"
            [attr.aria-expanded]="menuOpen()"
          >
            <app-icon name="menu" [size]="24" />
          </button>
          <a routerLink="/" class="flex items-center gap-2 lg:hidden" aria-label="Trang chủ HANOIVIBE">
            <img src="logo.png" alt="" class="h-7 w-auto" />
            <span class="font-extrabold tracking-wide text-slate-900">HANOI<span class="text-brand-600">VIBE</span></span>
          </a>
          <!-- Màn rộng: ô tìm toàn cục, Enter thì sang Khám phá quán với từ khoá -->
          <form class="hidden lg:flex lg:w-full lg:max-w-md" role="search" (submit)="search($event)">
            <label class="flex h-10 w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3.5 text-slate-500 transition focus-within:border-brand-500 focus-within:bg-white">
              <app-icon name="search" [size]="17" />
              <span class="sr-only">Tìm quán</span>
              <input
                type="search"
                name="q"
                [value]="q()"
                (input)="q.set($any($event.target).value)"
                class="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                placeholder="Tìm quán cafe, quán ăn, bar…"
              />
            </label>
          </form>
          <div class="ml-auto flex items-center gap-1">
            @if (auth.isLoggedIn()) {
              <!-- Chuông: tin nhắn / match mới chưa đọc -->
              <a routerLink="/dating" class="relative flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100" [attr.aria-label]="inbox.unread() ? inbox.unread() + ' tin mới' : 'Thông báo'">
                <app-icon name="inbox" [size]="22" />
                @if (inbox.unread() > 0) {
                  <span class="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#C2335F] px-1 text-[10px] font-bold leading-none text-white">{{ inbox.unread() }}</span>
                }
              </a>
            }
            <button
              type="button"
              class="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 lg:hidden"
              [attr.aria-label]="theme.isDark() ? 'Chuyển sang chế độ Sáng' : 'Chuyển sang chế độ Tối'"
              [attr.aria-pressed]="theme.isDark()"
              (click)="theme.toggle()"
            >
              <app-icon [name]="theme.isDark() ? 'sun' : 'moon'" [size]="22" />
            </button>
            <button
              type="button"
              class="hidden h-10 items-center gap-1.5 rounded-full bg-brand-600 px-4 text-[13px] font-semibold text-white transition hover:bg-brand-700 lg:flex"
              (click)="autoplanOpen.set(true)"
            >
              <app-icon name="shuffle" [size]="15" />Autoplan
            </button>
          </div>
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
                class="min-h-10 rounded-lg bg-amber-600 px-3 text-xs font-semibold text-white transition hover:bg-amber-700"
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
        @if (autoplanOpen()) {
          <app-autoplan-dialog (closed)="autoplanOpen.set(false)" />
        }
      </div>

      <!-- Thanh tab dưới (điện thoại, máy tính bảng dọc): 4 mục chính trong tầm ngón cái + "Thêm" mở menu đầy đủ -->
      <nav
        class="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label="Điều hướng nhanh"
      >
        <ul class="flex h-14 items-stretch">
          @for (t of tabs; track t.path) {
            <li class="min-w-0 flex-1">
              <a
                [routerLink]="t.path"
                routerLinkActive="text-brand-700"
                [routerLinkActiveOptions]="{ exact: t.path === '/' }"
                #rla="routerLinkActive"
                class="relative flex h-full flex-col items-center justify-center gap-0.5 text-xs font-medium text-slate-500"
                (click)="menuOpen.set(false)"
              >
                <span class="relative">
                  <app-icon [name]="t.icon" [size]="22" [stroke]="rla.isActive ? 2.4 : 2" [filled]="!!t.fillable && rla.isActive" />
                  @if (t.alert && t.alert() > 0) {
                    <span class="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#C2335F] px-1 text-xs font-bold leading-none text-white">{{ t.alert() }}</span>
                  }
                </span>
                <span class="truncate" [class.font-semibold]="rla.isActive">{{ t.label }}</span>
              </a>
            </li>
          }
          <li class="min-w-0 flex-1">
            <button
              type="button"
              class="flex h-full w-full flex-col items-center justify-center gap-0.5 text-xs font-medium text-slate-500"
              [class.text-brand-700]="menuOpen()"
              aria-label="Mở menu đầy đủ"
              [attr.aria-expanded]="menuOpen()"
              (click)="menuOpen.set(!menuOpen())"
            >
              <app-icon name="menu" [size]="22" />
              <span>Thêm</span>
            </button>
          </li>
        </ul>
      </nav>
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
  protected readonly inbox = inject(MatchInboxService);

  protected readonly menuOpen = signal(false);
  /** Menu tài khoản (cuối thanh bên) */
  protected readonly accountOpen = signal(false);
  protected readonly confirmLogoutAll = signal(false);
  private readonly account = viewChild<ElementRef<HTMLElement>>('account');

  /** Menu trượt trên điện thoại: khoá cuộn trang phía sau, nút Back đóng menu */
  private readonly drawer = isPlatformBrowser(inject(PLATFORM_ID))
    ? new OverlayHandle(inject(DOCUMENT), () => this.menuOpen.set(false), inject(Router))
    : null;

  constructor() {
    effect(() => {
      if (this.menuOpen()) this.drawer?.open();
      else this.drawer?.close();
    });
  }

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
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  /** Ô tìm trên thanh trên cùng (màn rộng) */
  protected readonly q = signal('');
  protected readonly autoplanOpen = signal(false);

  protected search(event: Event): void {
    event.preventDefault();
    const q = this.q().trim();
    void this.router.navigate(['/explore'], { queryParams: q ? { q } : {} });
    this.q.set('');
  }

  protected initial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || '?';
  }

  /** Thanh tab dưới của điện thoại */
  protected readonly tabs: TabItem[] = [
    { path: '/', label: 'Trang chủ', icon: 'home' },
    { path: '/explore', label: 'Khám phá', icon: 'compass' },
    { path: '/spots', label: 'Chỗ chơi', icon: 'gate' },
    { path: '/places', label: 'My place', icon: 'bookmark', fillable: true },
    { path: '/dating', label: 'Hẹn hò', icon: 'heart', fillable: true, alert: () => this.inbox.unread() },
  ];

  /**
   * Menu: Khám phá quán, Tìm chỗ chơi (danh mục chung) và My place (quán đã lưu của chính người
   * đăng nhập, lọc loại bằng chip trong trang) ở trên; nhóm "Quản trị" chỉ admin thấy.
   */
  protected readonly sections = computed<NavSection[]>(() => [
    {
      title: '',
      items: [
        { path: '/', label: 'Trang chủ', icon: 'home' },
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
