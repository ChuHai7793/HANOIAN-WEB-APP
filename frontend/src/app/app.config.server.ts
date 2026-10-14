import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { SERVER_API_ORIGIN } from './core/api/server-api-origin';

/** Cấu hình thêm khi render trên server (bản SSR). */
const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    // Server gọi thẳng backend (mạng nội bộ Render), không qua proxy /api của chính nó
    { provide: SERVER_API_ORIGIN, useValue: process.env['API_ORIGIN'] ?? 'http://localhost:8080' },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
