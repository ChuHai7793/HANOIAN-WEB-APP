import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { errorInterceptor } from './core/api/error.interceptor';
import { DataBootstrapService } from './core/services/data-bootstrap.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // withComponentInputBinding: tham số :id trên route đổ thẳng vào input của component
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([errorInterceptor])),
    // Tải dữ liệu trước khi hiện trang để không nháy "chưa có quán nào". Không bao giờ reject.
    provideAppInitializer(() => inject(DataBootstrapService).loadAll()),
  ],
};
