import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { errorMessage } from '../../core/api/api';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const { password, confirm } = group.value as { password: string; confirm: string };
  return password === confirm ? null : { mismatch: true };
}

@Component({
  selector: 'app-register-page',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div class="w-full max-w-sm">
        <div class="mb-6 text-center">
          <p class="text-4xl">💘</p>
          <h1 class="mt-2 text-2xl font-bold text-slate-900">Tạo tài khoản</h1>
          <p class="mt-1 text-sm text-slate-500">Dữ liệu của bạn chỉ mình bạn xem được</p>
        </div>

        <form
          class="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          [formGroup]="form"
          (ngSubmit)="submit()"
        >
          <div>
            <label for="displayName" class="mb-1.5 block text-sm font-medium text-slate-700">Tên hiển thị</label>
            <input
              id="displayName"
              formControlName="displayName"
              autocomplete="nickname"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div>
            <label for="email" class="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              autocomplete="email"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            @if (invalid('email')) {
              <p class="mt-1 text-xs text-rose-600">Email không hợp lệ.</p>
            }
          </div>

          <div>
            <label for="password" class="mb-1.5 block text-sm font-medium text-slate-700">Mật khẩu</label>
            <input
              id="password"
              type="password"
              formControlName="password"
              autocomplete="new-password"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <p class="mt-1 text-xs" [class]="invalid('password') ? 'text-rose-600' : 'text-slate-400'">
              Từ 8 đến 72 ký tự.
            </p>
          </div>

          <div>
            <label for="confirm" class="mb-1.5 block text-sm font-medium text-slate-700">Nhập lại mật khẩu</label>
            <input
              id="confirm"
              type="password"
              formControlName="confirm"
              autocomplete="new-password"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            @if (form.hasError('mismatch') && form.controls.confirm.touched) {
              <p class="mt-1 text-xs text-rose-600">Hai mật khẩu chưa khớp.</p>
            }
          </div>

          @if (error()) {
            <p class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ error() }}</p>
          }

          <button
            type="submit"
            class="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
            [disabled]="busy()"
          >
            {{ busy() ? 'Đang tạo tài khoản…' : 'Đăng ký' }}
          </button>

          <p class="text-center text-sm text-slate-500">
            Đã có tài khoản?
            <a routerLink="/login" class="font-medium text-brand-600 hover:text-brand-700">Đăng nhập</a>
          </p>
        </form>
      </div>
    </div>
  `,
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      displayName: ['', [Validators.required, Validators.maxLength(80)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
      confirm: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  protected invalid(control: 'email' | 'password'): boolean {
    const c = this.form.controls[control];
    return c.invalid && (c.dirty || c.touched);
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const { email, password, displayName } = this.form.getRawValue();
      await this.auth.register(email.trim(), password, displayName.trim());
      await this.router.navigateByUrl('/');
    } catch (err) {
      this.error.set(errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}
