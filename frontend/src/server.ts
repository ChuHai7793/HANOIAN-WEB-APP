import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { join } from 'node:path';

/**
 * Server Node cho bản SSR (`npm run build:ssr`, chạy `npm run serve:ssr`):
 * - `/api/*`, `/uploads/*` → chuyển tiếp sang backend Spring (API_ORIGIN), kể cả SSE và cookie refresh,
 *   để trình duyệt chỉ thấy một domain như khi dùng Static Site (rewrite /api).
 * - File tĩnh (JS, CSS, ảnh) trong dist/.../browser.
 * - Còn lại: Angular render HTML (trang công khai render trên server, trang cá nhân trả khung CSR; xem
 *   app.routes.server.ts).
 *
 * Biến môi trường: PORT, API_ORIGIN (vd. http://gfm-api:10000), NG_ALLOWED_HOSTS (tên miền được render,
 * cách nhau dấu phẩy, vd. "hanoivibe-ssr.onrender.com,hanoivibe.vn").
 */
const browserDistFolder = join(import.meta.dirname, '../browser');
const apiOrigin = process.env['API_ORIGIN'] ?? 'http://localhost:8080';

const app = express();
// Chống SSRF: chỉ render cho tên miền khai báo. Danh sách truyền vào đây được ưu tiên hơn biến môi trường,
// nên phải tự ghép NG_ALLOWED_HOSTS (tên miền trên Render) với localhost (chạy thử trên máy).
const allowedHosts = [
  'localhost',
  '127.0.0.1',
  ...(process.env['NG_ALLOWED_HOSTS'] ?? '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean),
];
const angularApp = new AngularNodeAppEngine({
  allowedHosts,
  // Render đứng trước server và gửi X-Forwarded-For/Host/Proto. Không tin các header này thì Angular lặng lẽ
  // bỏ render trên server (trả khung trống như bản static).
  trustProxyHeaders: true,
});

app.disable('x-powered-by');

app.use(
  createProxyMiddleware({
    target: apiOrigin,
    changeOrigin: true,
    // Backend thấy IP thật của người dùng (giới hạn tần suất theo IP)
    xfwd: true,
    pathFilter: ['/api', '/uploads'],
    // SSE (tin nhắn realtime) giữ kết nối lâu: không cắt
    proxyTimeout: 0,
  }),
);

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) throw error;
    console.log(`SSR server: http://localhost:${port} (API → ${apiOrigin})`);
  });
}

/** Handler cho Angular CLI (ng serve) và các nền tảng serverless */
export const reqHandler = createNodeRequestHandler(app);
