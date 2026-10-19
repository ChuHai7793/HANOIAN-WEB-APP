import { isPlatformBrowser } from '@angular/common';
import { Component, DOCUMENT, effect, ElementRef, HostListener, inject, PLATFORM_ID, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { OverlayHandle } from './overlay';
import { errorMessage } from '../../core/api/api';
import { AuthService } from '../../core/auth/auth.service';
import { LoginGate } from '../../core/auth/login-gate.service';

/**
 * Popup đăng nhập mở bởi {@link LoginGate}: khách bấm việc cần tài khoản thì hiện ngay trên trang đang xem (nền
 * phía sau mờ đi), đóng được bằng ✕, bấm ra ngoài hoặc Esc. Đăng nhập xong thì làm tiếp việc vừa bấm.
 */
@Component({
  selector: 'app-login-prompt',
  imports: [ReactiveFormsModule],
  template: `
    @if (gate.prompt(); as p) {
      <div class="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
        <div class="fixed inset-0 bg-slate-900/45 backdrop-blur-[3px]" (click)="close()"></div>

        <div role="dialog" aria-modal="true" aria-labelledby="login-prompt-title" class="relative z-10 max-h-[calc(100dvh-1.5rem)] w-full max-w-sm overflow-y-auto overscroll-contain rounded-t-2xl bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl">
          <button
            type="button"
            class="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            (click)="close()"
            aria-label="Đóng"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div class="mb-5 text-center">
            <img src="logo.png" alt="" class="mx-auto h-11 w-auto" />
            <h2 id="login-prompt-title" class="mt-3 text-lg font-bold text-slate-900">Hãy đăng nhập để trải nghiệm chức năng này</h2>
            <p class="mt-1 text-sm text-slate-500">Đăng nhập để {{ p.action }}.</p>
          </div>

          <form class="space-y-3.5" [formGroup]="form" (ngSubmit)="submit()">
            <div>
              <label for="prompt-login" class="mb-1.5 block text-sm font-medium text-slate-700">Tên đăng nhập hoặc email</label>
              <input
                #first
                id="prompt-login"
                type="text"
                formControlName="login"
                autocomplete="username"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div>
              <label for="prompt-password" class="mb-1.5 block text-sm font-medium text-slate-700">Mật khẩu</label>
              <input
                id="prompt-password"
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
              <button type="button" class="font-medium text-brand-600 hover:text-brand-700" (click)="register()">Đăng ký miễn phí</button>
            </p>
          </form>
        </div>
      </div>
    }
  `,
})
export class LoginPromptComponent {
  protected readonly gate = inject(LoginGate);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly first = viewChild<ElementRef<HTMLInputElement>>('first');

  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly form = inject(FormBuilder).nonNullable.group({
    login: ['', Validators.required],
    password: ['', Validators.required],
  });

  /** Khoá cuộn trang phía sau, nút Back của điện thoại đóng popup */
  private readonly overlay = isPlatformBrowser(inject(PLATFORM_ID))
    ? new OverlayHandle(inject(DOCUMENT), () => this.close(), this.router)
    : null;

  constructor() {
    // Mỗi lần mở: form trống, con trỏ ở ô đầu tiên
    effect(() => {
      if (!this.gate.prompt()) {
        this.overlay?.close();
        return;
      }
      this.overlay?.open();
      this.form.reset();
      this.error.set('');
      queueMicrotask(() => this.first()?.nativeElement.focus());
    });
  }

  @HostListener('document:keydown.escape')
  protected close(): void {
    if (!this.busy()) this.gate.close();
  }

  protected async register(): Promise<void> {
    const p = this.gate.prompt();
    this.gate.close();
    await this.router.navigate(['/register'], { queryParams: { returnUrl: p?.returnUrl } });
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.error.set('Nhập tên đăng nhập (hoặc email) và mật khẩu.');
      return;
    }
    const p = this.gate.prompt();
    this.busy.set(true);
    this.error.set('');
    try {
      const { login, password } = this.form.getRawValue();
      await this.auth.login(login.trim(), password);
      this.gate.close();
      await p?.resume?.();
    } catch (err) {
      this.error.set(errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}
