import { HttpInterceptorFn } from '@angular/common/http';
import { inject, InjectionToken } from '@angular/core';

/**
 * Địa chỉ backend khi render trên server (bản SSR), vd. "http://gfm-api:10000". Trình duyệt không có
 * giá trị này: vẫn gọi đường dẫn tương đối /api/v1 như bản static.
 */
export const SERVER_API_ORIGIN = new InjectionToken<string | null>('SERVER_API_ORIGIN', {
  factory: () => null,
});

/** Trên server, đường dẫn tương đối "/api/..." không có domain: gắn địa chỉ backend vào. */
export const serverApiOriginInterceptor: HttpInterceptorFn = (req, next) => {
  const origin = inject(SERVER_API_ORIGIN);
  return origin && req.url.startsWith('/') ? next(req.clone({ url: origin + req.url })) : next(req);
};
