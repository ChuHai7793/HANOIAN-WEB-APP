import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { SKIP_AUTH } from './http-context';

/**
 * Gắn `Authorization: Bearer` cho mọi request /api. Gặp 401 thì refresh access token một lần
 * rồi gửi lại; refresh thất bại thì chuyển về trang đăng nhập.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/') || req.context.get(SKIP_AUTH)) {
    return next(req);
  }
  const auth = inject(AuthService);

  return next(withToken(req, auth.token())).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401) {
        return throwError(() => err);
      }
      return from(auth.refreshAccessToken()).pipe(
        switchMap((token) => {
          if (!token) {
            auth.onSessionExpired();
            return throwError(() => err);
          }
          return next(withToken(req, token));
        }),
      );
    }),
  );
};

function withToken(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
}
