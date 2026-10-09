import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { AdminUser, GENDERS } from '../../core/models/profile.model';
import { ProfileService } from '../../core/services/profile.service';

/** Chỉ admin: danh sách tài khoản đã đăng ký và hồ sơ họ đã nhập. */
@Component({
  selector: 'app-user-list-page',
  imports: [DatePipe],
  template: `
    <div class="p-4 sm:p-6 lg:p-8">
      <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <span>👥</span> Người dùng
          </h1>
          <p class="mt-1 text-sm text-slate-500">Tài khoản đã đăng ký và hồ sơ cá nhân của họ</p>
        </div>
        <input
          type="search"
          [value]="search()"
          (input)="search.set($any($event.target).value)"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 sm:w-64"
          placeholder="Tìm theo tên, email, thành phố…"
        />
      </div>

      @if (loading()) {
        <p class="text-sm text-slate-500">Đang tải…</p>
      } @else if (filtered().length === 0) {
        <p class="text-sm text-slate-500">Không có người dùng nào.</p>
      } @else {
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          @for (u of filtered(); track u.id) {
            <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div class="flex items-center gap-3">
                @if (u.profile.avatarUrl) {
                  <img
                    [src]="u.profile.avatarUrl"
                    alt=""
                    class="h-12 w-12 shrink-0 rounded-full object-cover"
                    loading="lazy"
                  />
                } @else {
                  <span
                    class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700"
                  >
                    {{ initial(u.profile.displayName) }}
                  </span>
                }
                <div class="min-w-0 flex-1">
                  <p class="truncate font-semibold text-slate-900">
                    {{ u.profile.displayName }}
                    <span
                      class="ml-1 rounded px-1.5 py-0.5 text-[10px] font-medium"
                      [class]="u.role === 'ADMIN' ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'"
                    >
                      {{ u.role === 'ADMIN' ? 'Admin' : 'Chỉ xem' }}
                    </span>
                  </p>
                  <p class="truncate text-xs text-slate-500">{{ u.username || u.email }}</p>
                </div>
              </div>

              @if (u.profile.version === null) {
                <p class="mt-4 text-sm italic text-slate-400">Chưa nhập hồ sơ.</p>
              } @else {
                <dl class="mt-4 space-y-1.5 text-sm">
                  @if (u.profile.gender) {
                    <div class="flex gap-2"><dt class="w-24 text-slate-400">Giới tính</dt><dd class="text-slate-700">{{ genderLabel(u.profile.gender) }}</dd></div>
                  }
                  @if (u.profile.birthday) {
                    <div class="flex gap-2"><dt class="w-24 text-slate-400">Ngày sinh</dt><dd class="text-slate-700">{{ u.profile.birthday | date: 'dd/MM/yyyy' }}</dd></div>
                  }
                  @if (u.profile.phone) {
                    <div class="flex gap-2"><dt class="w-24 text-slate-400">Điện thoại</dt><dd class="text-slate-700">{{ u.profile.phone }}</dd></div>
                  }
                  @if (u.profile.city) {
                    <div class="flex gap-2"><dt class="w-24 text-slate-400">Thành phố</dt><dd class="text-slate-700">{{ u.profile.city }}</dd></div>
                  }
                </dl>
                @if (u.profile.bio) {
                  <p class="mt-3 whitespace-pre-line rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{{ u.profile.bio }}</p>
                }
              }

              <p class="mt-4 text-xs text-slate-400">
                Email: {{ u.email }} · Đăng ký {{ u.createdAt | date: 'dd/MM/yyyy' }}
              </p>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class UserListPage implements OnInit {
  private readonly profiles = inject(ProfileService);

  protected readonly loading = signal(true);
  protected readonly users = signal<AdminUser[]>([]);
  protected readonly search = signal('');

  protected readonly filtered = computed(() => {
    const keyword = this.search().trim().toLowerCase();
    if (!keyword) return this.users();
    return this.users().filter((u) =>
      [u.profile.displayName, u.email, u.username, u.profile.city, u.profile.phone]
        .filter(Boolean)
        .some((s) => s!.toLowerCase().includes(keyword)),
    );
  });

  async ngOnInit(): Promise<void> {
    try {
      this.users.set(await this.profiles.adminUsers());
    } finally {
      this.loading.set(false);
    }
  }

  protected initial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || '?';
  }

  protected genderLabel(value: string): string {
    return GENDERS.find((g) => g.value === value)?.label ?? value;
  }
}
