import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PlaceService } from '../core/services/place.service';
import { GirlfriendService } from '../core/services/girlfriend.service';
import { DataBootstrapService } from '../core/services/data-bootstrap.service';
import { AuthService } from '../core/auth/auth.service';
import { LegacyImportDialogComponent } from '../shared/ui/legacy-import-dialog.component';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  badge: () => number;
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LegacyImportDialogComponent],
  template: `
    <div class="flex min-h-screen">
      <!-- Sidebar -->
      <aside
        class="fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-200 bg-white transition-transform lg:translate-x-0"
        [class.-translate-x-full]="!menuOpen()"
      >
        <div class="flex h-16 items-center gap-2.5 border-b border-slate-100 px-5">
          <span class="text-2xl">💘</span>
          <div>
            <p class="text-sm font-bold leading-tight text-slate-900">Dating Master</p>
            <p class="text-[11px] leading-tight text-slate-400">Sổ tay hẹn hò</p>
          </div>
        </div>

        <nav class="space-y-1 p-3">
          @for (item of navItems; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="bg-brand-50 text-brand-700 font-semibold"
              class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50"
              (click)="menuOpen.set(false)"
            >
              <span class="text-lg">{{ item.icon }}</span>
              <span class="flex-1">{{ item.label }}</span>
              <span
                class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500"
              >
                {{ item.badge() }}
              </span>
            </a>
          }
        </nav>

        <div class="absolute bottom-0 w-full border-t border-slate-100 p-4">
          @if (auth.user(); as user) {
            <div class="flex items-center gap-3">
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700"
              >
                {{ initial(user.displayName) }}
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-slate-800">
                  {{ user.displayName }}
                  @if (user.role === 'GUEST') {
                    <span class="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                      Chỉ xem
                    </span>
                  }
                </p>
                <p class="truncate text-[11px] text-slate-400">{{ user.username || user.email }}</p>
              </div>
            </div>
            <div class="mt-3 flex gap-2">
              <button
                type="button"
                class="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                (click)="auth.logout()"
              >
                Đăng xuất
              </button>
              <button
                type="button"
                class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 transition hover:bg-slate-50"
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
            <svg
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path stroke-linecap="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span class="font-semibold text-slate-800">Dating Master</span>
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

  protected readonly menuOpen = signal(false);
  protected readonly bootstrap = inject(DataBootstrapService);
  protected readonly auth = inject(AuthService);

  protected initial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || '?';
  }

  protected readonly navItems: NavItem[] = [
    {
      path: '/cafes',
      label: 'Quán cafe',
      icon: '☕',
      badge: () => this.places.cafes().length,
    },
    {
      path: '/bars',
      label: 'Quán bar',
      icon: '🍸',
      badge: () => this.places.bars().length,
    },
    {
      path: '/restaurants',
      label: 'Quán ăn',
      icon: '🍜',
      badge: () => this.places.restaurants().length,
    },
    {
      path: '/girlfriends',
      label: 'Người yêu',
      icon: '👩',
      badge: () => this.girlfriends.count(),
    },
  ];
}
