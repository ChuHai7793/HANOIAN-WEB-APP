import { afterNextRender, Component, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { errorMessage } from '../../core/api/api';
import { AuthService } from '../../core/auth/auth.service';
import { SocialLoginService } from '../../core/auth/social-login.service';

/**
 * Hàng nút "Tiếp tục với Google / Facebook" dùng trên trang đăng nhập, đăng ký và popup đăng nhập. Chỉ hiện nút của
 * nhà cung cấp mà backend đã cấu hình; SDK bị chặn thì nút không hiện, form email/mật khẩu vẫn dùng bình thường.
 * Xong thì phát `done` với `true` nếu tài khoản vừa được tạo (trang cha mời nhập hồ sơ).
 */
@Component({
  selector: 'app-social-login',
  template: `
    @if (googleClientId() || facebookAppId()) {
      <div class="flex flex-col gap-3">
        <div class="flex items-center gap-3 text-xs text-slate-400">
          <span class="h-px flex-1 bg-slate-200"></span>{{ divider() }}<span class="h-px flex-1 bg-slate-200"></span>
        </div>
        @if (googleClientId()) {
          <div #google class="flex min-h-11 justify-center" [class.opacity-50]="busy()" [class.pointer-events-none]="busy()"></div>
        }
        @if (facebookAppId()) {
          <button
            type="button"
            class="flex min-h-11 w-full items-center justify-center gap-2.5 rounded-full bg-[#1877F2] px-4 text-sm font-semibold text-white transition hover:bg-[#166FE5] disabled:opacity-60"
            [disabled]="busy()"
            (click)="facebook()"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.3l-.5 3.5h-2.8v8.4A12 12 0 0 0 24 12z" />
            </svg>
            {{ busy() ? 'Đang đăng nhập…' : 'Tiếp tục với Facebook' }}
          </button>
        }
        @if (error()) {
          <p class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ error() }}</p>
        }
      </div>
    }
  `,
})
export class SocialLoginComponent {
  private readonly social = inject(SocialLoginService);
  private readonly auth = inject(AuthService);
  private readonly googleHost = viewChild<ElementRef<HTMLElement>>('google');

  /** Chữ trên đường kẻ, vd. "hoặc" */
  readonly divider = input('hoặc');
  /** Đăng nhập xong: true = tài khoản mới tạo */
  readonly done = output<boolean>();

  protected readonly googleClientId = signal<string | null>(null);
  protected readonly facebookAppId = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  constructor() {
    afterNextRender(async () => {
      const p = await this.social.providers();
      this.facebookAppId.set(p.facebookAppId);
      this.googleClientId.set(p.googleClientId);
      if (!p.googleClientId) return;
      // Khe nút Google vừa hiện ở lần vẽ sau khi set signal
      await new Promise((r) => setTimeout(r));
      const host = this.googleHost()?.nativeElement;
      if (!host) return;
      const ok = await this.social.renderGoogleButton(host, p.googleClientId, (credential) => void this.google(credential));
      if (!ok) this.googleClientId.set(null);
    });
  }

  private async google(credential: string): Promise<void> {
    await this.finish(() => this.auth.loginWithGoogle(credential));
  }

  protected async facebook(): Promise<void> {
    const appId = this.facebookAppId();
    if (!appId || this.busy()) return;
    this.error.set('');
    const token = await this.social.facebookLogin(appId);
    if (!token) return;
    await this.finish(() => this.auth.loginWithFacebook(token));
  }

  private async finish(login: () => Promise<boolean>): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      this.done.emit(await login());
    } catch (err) {
      this.error.set(errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}
