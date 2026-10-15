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

/** Tên miền đang được mở (sau proxy của Render), để viết URL tuyệt đối trong sitemap */
function origin(req: express.Request): string {
  const proto = (req.get('x-forwarded-proto') ?? req.protocol).split(',')[0].trim();
  return `${proto}://${req.get('x-forwarded-host') ?? req.get('host')}`;
}

// Bản SSR là bản cho Google index (bản static chặn index bằng public/robots.txt)
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /p/\n\nSitemap: ${origin(req)}/sitemap.xml\n`);
});

/** sitemap.xml: trang chính + mọi quán, chỗ chơi, bài viết đã xuất bản (lấy từ backend) */
app.get('/sitemap.xml', async (req, res) => {
  try {
    const r = await fetch(`${apiOrigin}/api/v1/public/sitemap`);
    const entries = r.ok ? ((await r.json()) as { path: string; updatedAt: string | null }[]) : [];
    const base = origin(req);
    const fixed = ['/explore', '/spots', '/cam-nang', '/quiz', '/autoplan'].map((path) => ({ path, updatedAt: null }));
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const urls = [...fixed, ...entries]
      .map(
        (e) =>
          `  <url><loc>${esc(base + e.path)}</loc>${e.updatedAt ? `<lastmod>${e.updatedAt.slice(0, 10)}</lastmod>` : ''}</url>`,
      )
      .join('\n');
    res
      .type('application/xml')
      .set('Cache-Control', 'public, max-age=3600')
      .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  } catch {
    res.status(503).type('text/plain').send('Sitemap tạm thời không tạo được.');
  }
});

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
