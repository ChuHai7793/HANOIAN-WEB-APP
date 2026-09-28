import { HttpInterceptorFn } from '@angular/common/http';
import { IDEMPOTENCY_KEY } from './http-context';

/**
 * Gắn `Idempotency-Key` cho mọi POST /api (trừ /auth): server gặp lại key cũ thì trả lại kết quả
 * lần trước thay vì tạo bản ghi mới. Đứng trước authInterceptor nên lần gửi lại sau khi refresh
 * token vẫn giữ nguyên key.
 */
export const idempotencyInterceptor: HttpInterceptorFn = (req, next) => {
  if (
    req.method !== 'POST' ||
    !req.url.startsWith('/api/') ||
    req.url.startsWith('/api/v1/auth/')
  ) {
    return next(req);
  }
  const key = req.context.get(IDEMPOTENCY_KEY) ?? crypto.randomUUID();
  return next(req.clone({ setHeaders: { 'Idempotency-Key': key } }));
};
