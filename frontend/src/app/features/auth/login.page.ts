import { Component, inject, input, isDevMode, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { errorMessage } from '../../core/api/api';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div class="w-full max-w-sm">
        <div class="mb-6 text-center">
          <p class="text-4xl">💘</p>
          <h1 class="mt-2 text-2xl font-bold text-slate-900">Dating Master</h1>
          <p class="mt-1 text-sm text-slate-500">Đăng nhập để xem sổ tay hẹn hò của bạn</p>
        </div>

        <form
          class="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          [formGroup]="form"
          (ngSubmit)="submit()"
        >
          <div>
            <label for="login" class="mb-1.5 block text-sm font-medium text-slate-700">
              Tên đăng nhập hoặc email
            </label>
            <input
              id="login"
              type="text"
              formControlName="login"
              autocomplete="username"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div>
            <label for="password" class="mb-1.5 block text-sm font-medium text-slate-700">Mật khẩu</label>
            <input
              id="password"
              type="password"
              formControlName="password"
              autocomplete="current-password"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          @if (error()) {
            <p class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ error() }}</p>
          }

          <button
            type="submit"
            class="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
            [disabled]="busy()"
          >
            {{ busy() ? 'Đang đăng nhập…' : 'Đăng nhập' }}
          </button>

          <p class="text-center text-sm text-slate-500">
            Chưa có tài khoản?
            <a routerLink="/register" class="font-medium text-brand-600 hover:text-brand-700">Đăng ký</a>
          </p>
        </form>

        @if (devMode) {
          <p class="mt-4 text-center text-xs text-slate-400">
            Dev: <code>admin</code> / <code>admin&#64;12345</code> (thêm, sửa, xoá) ·
            <code>guest</code> / <code>guest&#64;12345</code> (chỉ xem)
          </p>
        }
      </div>
    </div>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Trang định vào trước khi bị chuyển tới đây (query param ?returnUrl=) */
  readonly returnUrl = input<string>();

  protected readonly devMode = isDevMode();
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected readonly form = inject(FormBuilder).nonNullable.group({
    login: ['', Validators.required],
    password: ['', Validators.required],
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.error.set('Nhập tên đăng nhập (hoặc email) và mật khẩu.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const { login, password } = this.form.getRawValue();
      await this.auth.login(login.trim(), password);
      await this.router.navigateByUrl(safeReturnUrl(this.returnUrl()));
    } catch (err) {
      this.error.set(errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}

/** Chỉ cho quay về đường dẫn nội bộ, tránh open redirect kiểu ?returnUrl=https://evil */
export function safeReturnUrl(url: string | undefined): string {
  return url && url.startsWith('/') && !url.startsWith('//') ? url : '/';
}
