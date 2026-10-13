import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

export interface LoginPrompt {
  /** Việc khách định làm, ghép sau "Đăng nhập để …" (vd. "lưu quán vào My place") */
  action: string;
  /** Đăng ký xong thì quay về đây */
  returnUrl: string;
  /** Đăng nhập xong trong popup thì làm tiếp việc vừa bấm */
  resume?: () => unknown;
}

/**
 * Khách (chưa đăng nhập) bấm việc cần tài khoản (Lưu, Vào plan, mở My place…): hiện popup đăng nhập ngay trên
 * trang đang xem, đóng được. Đăng nhập xong thì làm tiếp việc vừa bấm.
 * Dùng: {@code if (!this.gate.check('lưu quán', () => this.save(item))) return;}
 */
@Injectable({ providedIn: 'root' })
export class LoginGate {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Popup đang mở (null = đóng) */
  readonly prompt = signal<LoginPrompt | null>(null);

  /** true = đã đăng nhập, làm tiếp; false = đã mở popup đăng nhập */
  check(action: string, resume?: () => unknown, returnUrl = this.router.url): boolean {
    if (this.auth.isLoggedIn()) return true;
    this.prompt.set({ action, returnUrl, resume });
    return false;
  }

  close(): void {
    this.prompt.set(null);
  }
}
