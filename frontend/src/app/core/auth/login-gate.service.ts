import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ToastService } from '../services/toast.service';
import { AuthService } from './auth.service';

/**
 * Khách (chưa đăng nhập) bấm việc cần tài khoản (Lưu, Vào plan, lưu plan…): mời đăng ký, xong quay lại đúng
 * trang đang xem. Dùng: {@code if (!this.gate.check('lưu quán')) return;}
 */
@Injectable({ providedIn: 'root' })
export class LoginGate {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  /** true = đã đăng nhập, làm tiếp; false = đã chuyển sang trang đăng ký */
  check(action: string, returnUrl = this.router.url): boolean {
    if (this.auth.isLoggedIn()) return true;
    this.toast.show(`Tạo tài khoản miễn phí để ${action}.`, 'info');
    void this.router.navigate(['/register'], { queryParams: { returnUrl } });
    return false;
  }
}
