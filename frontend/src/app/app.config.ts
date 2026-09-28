import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/api/auth.interceptor';
import { errorInterceptor } from './core/api/error.interceptor';
import { idempotencyInterceptor } from './core/api/idempotency.interceptor';
import { AuthService } from './core/auth/auth.service';
import { DataBootstrapService } from './core/services/data-bootstrap.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // withComponentInputBinding: tham số :id trên route đổ thẳng vào input của component
    provideRouter(routes, withComponentInputBinding()),
    // errorInterceptor đứng ngoài cùng: chỉ thấy lỗi cuối cùng, sau khi authInterceptor đã
    // refresh token và thử lại, nên không hiện toast cho 401 đã tự xử lý được
    // idempotencyInterceptor đứng trước authInterceptor: lần gửi lại sau refresh giữ nguyên key
    provideHttpClient(
      withFetch(),
      withInterceptors([errorInterceptor, idempotencyInterceptor, authInterceptor]),
    ),
    // Khôi phục phiên (cookie refresh) rồi tải dữ liệu, trước khi router chạy guard
    provideAppInitializer(async () => {
      const auth = inject(AuthService);
      const bootstrap = inject(DataBootstrapService);
      if (await auth.restoreSession()) {
        await bootstrap.loadAll();
      }
    }),
  ],
};
