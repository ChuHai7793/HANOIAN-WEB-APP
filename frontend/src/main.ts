import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { loadAnalytics } from './app/core/analytics';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));

// Đếm lượt truy cập (Cloudflare Web Analytics); main.ts chỉ chạy trên trình duyệt, không chạy khi render trên server
loadAnalytics();
