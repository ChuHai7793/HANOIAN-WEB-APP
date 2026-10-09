import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Trang cần đăng nhập: chưa đăng nhập thì về /login, nhớ trang định vào để quay lại sau. */
export const authGuard: CanMatchFn = (_route, segments) => {
  if (inject(AuthService).isLoggedIn()) return true;
  const returnUrl = '/' + segments.map((s) => s.path).join('/');
  return inject(Router).createUrlTree(['/login'], {
    queryParams: returnUrl === '/' ? {} : { returnUrl },
  });
};

/** Trang chỉ dành cho admin (danh sách người dùng): người khác về trang chính. */
export const adminGuard: CanMatchFn = () =>
  inject(AuthService).user()?.role === 'ADMIN' ? true : inject(Router).createUrlTree(['/']);

/** Trang login/register: đã đăng nhập thì vào thẳng app. */
export const guestGuard: CanMatchFn = () =>
  inject(AuthService).isLoggedIn() ? inject(Router).createUrlTree(['/']) : true;
