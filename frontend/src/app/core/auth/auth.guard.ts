import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { LoginGate } from './login-gate.service';

/**
 * Trang cần đăng nhập. Khách đang dùng app (bấm menu, link…): ở nguyên trang hiện tại và hiện popup đăng nhập,
 * đăng nhập xong thì vào trang định vào. Mở thẳng đường dẫn (chưa có trang nào phía sau): về /login.
 */
export const authGuard: CanMatchFn = (route, segments) => {
  if (inject(AuthService).isLoggedIn()) return true;
  const router = inject(Router);
  const returnUrl = '/' + segments.map((s) => s.path).join('/');
  if (router.navigated) {
    const page = typeof route.title === 'string' ? route.title.split(' · ')[0] : '';
    inject(LoginGate).check(page ? `dùng ${page}` : 'dùng chức năng này', () => router.navigateByUrl(returnUrl), returnUrl);
    // canMatch trả false thì router thử tiếp route '**' (về trang chủ): giữ nguyên trang đang xem
    return router.parseUrl(router.url);
  }
  return router.createUrlTree(['/login'], {
    queryParams: returnUrl === '/' ? {} : { returnUrl },
  });
};

/** Trang chỉ dành cho admin (danh sách người dùng): người khác về trang chính. */
export const adminGuard: CanMatchFn = () =>
  inject(AuthService).user()?.role === 'ADMIN' ? true : inject(Router).createUrlTree(['/']);

/** Trang login/register: đã đăng nhập thì vào thẳng app. */
export const guestGuard: CanMatchFn = () =>
  inject(AuthService).isLoggedIn() ? inject(Router).createUrlTree(['/']) : true;
