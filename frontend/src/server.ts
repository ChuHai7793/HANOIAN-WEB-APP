import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import compression from 'compression';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { Agent as HttpAgent, type IncomingMessage } from 'node:http';
import { Agent as HttpsAgent } from 'node:https';
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
 * cách nhau dấu phẩy, vd. "www.hanoivibe.com.vn,hanoivibe.com.vn,hanoivibe.onrender.com"), SSR_CACHE_SECONDS (giữ HTML đã
 * render bao lâu, mặc định 60; 0 = tắt), CANONICAL_HOST (tên miền chính, host khác chuyển 301 về đây),
 * PROXY_SECRET (chuỗi bí mật chung với backend, để backend tin IP người dùng do server này báo).
 *
 * Cho nhanh bằng bản Static Site (vốn đi qua CDN của Render):
 * - Nén gzip / brotli mọi phản hồi trừ /api (SSE không được nén vì nén sẽ giữ lại dữ liệu).
 * - Proxy /api giữ kết nối tới backend (keep-alive): không bắt tay TLS lại cho từng request.
 * - HTML đã render được giữ trong bộ nhớ (xem htmlCache): server luôn render như khách nên HTML của mọi người
 *   giống nhau.
 */
const browserDistFolder = join(import.meta.dirname, '../browser');
const apiOrigin = process.env['API_ORIGIN'] ?? 'http://localhost:8080';

const app = express();
// Chống SSRF: chỉ render cho tên miền khai báo. Danh sách truyền vào đây được ưu tiên hơn biến môi trường,
// nên phải tự ghép NG_ALLOWED_HOSTS (tên miền trên Render) với localhost (chạy thử trên máy).
// CANONICAL_HOST và bản có / không có www của nó luôn được nhận, kể cả khi quên khai báo trong NG_ALLOWED_HOSTS.
const canonicalHost = (process.env['CANONICAL_HOST'] ?? '').trim().toLowerCase();
const bareHost = canonicalHost.replace(/^www\./, '');
const publicHosts = [
  ...new Set(
    [...(process.env['NG_ALLOWED_HOSTS'] ?? '').split(','), bareHost, bareHost && `www.${bareHost}`]
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
  ),
];
const allowedHosts = ['localhost', '127.0.0.1', ...publicHosts];
const angularApp = new AngularNodeAppEngine({
  allowedHosts,
  // Render đứng trước server và gửi X-Forwarded-Host/Proto. Không tin các header này thì Angular lặng lẽ
  // bỏ render trên server (trả khung trống như bản static). Không tin X-Forwarded-Port: ai cũng gửi được
  // "X-Forwarded-Port: 1337", link canonical trong HTML thành https://host:1337/... rồi bị giữ trong htmlCache
  // cho mọi người (đầu độc cache).
  trustProxyHeaders: ['x-forwarded-host', 'x-forwarded-proto'],
});

app.disable('x-powered-by');

/**
 * Header bảo mật cho mọi phản hồi (phản hồi /api giữ header của backend nếu backend tự đặt):
 * - Không cho trang khác nhúng trang này vào iframe (chống clickjacking: lừa bấm nút dưới lớp trong suốt).
 * - HSTS: trình duyệt luôn mở bằng https, kể cả khi gõ http:// (chỉ bật khi chạy thật, có CANONICAL_HOST).
 * - nosniff: trình duyệt không đoán file tải lên là HTML / JS.
 * - Không gửi đường dẫn đầy đủ sang trang khác; chỉ trang này được xin vị trí (nút "gần tôi"), không camera, mic.
 * Không đặt script-src: Cloudflare Analytics, đăng nhập Google và script Angular chèn vào HTML đều cần chạy.
 */
app.use((_req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), payment=(), geolocation=(self)');
  if (canonicalHost) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

/**
 * Tên miền chính (CANONICAL_HOST, vd. www.hanoivibe.com.vn; phải trùng tên chính trên Render, ngược chiều thì
 * Render và server chuyển qua lại mãi): mở trang bằng tên miền public khác (bản không www, *.onrender.com)
 * thì chuyển 301 về đây, để Google chỉ index một bản và link cũ dồn về tên miền mới. Biến trống (chạy local) thì
 * bỏ qua.
 * - Chỉ chuyển host có trong publicHosts: health check của Render gọi bằng địa chỉ nội bộ, không bị chuyển.
 * - Không chuyển /api, /uploads: trình duyệt đang mở tên miền cũ vẫn gọi API được tới khi tải lại trang.
 */
app.use((req, res, next) => {
  if (!canonicalHost || (req.method !== 'GET' && req.method !== 'HEAD')) return next();
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
  const host = (req.get('x-forwarded-host') ?? req.get('host') ?? '').split(',')[0].trim().toLowerCase().replace(/:\d+$/, '');
  if (host === canonicalHost || !publicHosts.includes(host)) return next();
  res.redirect(301, `https://${canonicalHost}${req.originalUrl}`);
});

/** Giữ kết nối tới backend giữa các request (mặc định Node mở kết nối mới cho mỗi request qua proxy) */
const apiAgent = apiOrigin.startsWith('https:')
  ? new HttpsAgent({ keepAlive: true, maxSockets: 64 })
  : new HttpAgent({ keepAlive: true, maxSockets: 64 });

/**
 * Gốc URL tuyệt đối trong sitemap, robots.txt: luôn là tên miền chính, không lấy Host / X-Forwarded-Host của
 * request (ai cũng gửi được tên miền giả, sitemap.xml lại được giữ cache 1 giờ). Chạy local (không có
 * CANONICAL_HOST) thì dùng localhost.
 */
function origin(req: express.Request): string {
  return canonicalHost ? `https://${canonicalHost}` : `${req.protocol}://${req.get('host')}`;
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
    const fixed = ['/', '/explore', '/spots', '/cam-nang', '/quiz', '/autoplan'].map((path) => ({ path, updatedAt: null }));
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

/**
 * IP thật của người dùng: phần tử cuối của X-Forwarded-For do Render nối vào. Phần đầu trình duyệt tự ghi được,
 * nên không chuyển tiếp nguyên header đó cho backend (đổi IP giả mỗi lần là vượt được giới hạn dò mật khẩu).
 */
function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  const list = (Array.isArray(forwarded) ? forwarded.join(',') : (forwarded ?? '')).split(',');
  return list[list.length - 1].trim() || req.socket.remoteAddress || '';
}

/** Chung với backend (cùng biến PROXY_SECRET): backend chỉ tin X-Client-IP khi kèm đúng khoá này */
const proxySecret = (process.env['PROXY_SECRET'] ?? '').trim();

app.use(
  createProxyMiddleware({
    target: apiOrigin,
    changeOrigin: true,
    pathFilter: ['/api', '/uploads'],
    // SSE (tin nhắn realtime) giữ kết nối lâu: không cắt
    proxyTimeout: 0,
    agent: apiAgent,
    on: {
      // Backend thấy IP thật của người dùng (giới hạn tần suất theo IP); header trình duyệt tự gửi bị thay
      proxyReq: (proxyReq, req) => {
        const ip = clientIp(req);
        proxyReq.setHeader('x-forwarded-for', ip);
        proxyReq.removeHeader('x-client-ip');
        proxyReq.removeHeader('x-proxy-key');
        if (proxySecret && ip) {
          proxyReq.setHeader('x-client-ip', ip);
          proxyReq.setHeader('x-proxy-key', proxySecret);
        }
      },
    },
  }),
);

// Nén đặt SAU proxy: phản hồi /api (kể cả SSE) đi thẳng qua proxy, không bị nén và không bị giữ lại
app.use(compression());

app.use(
  express.static(browserDistFolder, {
    // File có mã băm trong tên (main-AB12.js) không bao giờ đổi nội dung: trình duyệt khỏi hỏi lại
    setHeaders: (res, path) => {
      const hashed = /-[A-Z0-9]{8}\.(js|css)$/.test(path);
      res.setHeader('Cache-Control', hashed ? 'public, max-age=31536000, immutable' : 'public, max-age=86400');
    },
    index: false,
    redirect: false,
  }),
);

/**
 * HTML đã render, theo host + đường dẫn + query. Server không biết người xem là ai (luôn render như khách), nên
 * cùng một URL cho ra cùng một HTML: giữ lại để lượt mở sau trả ngay, không phải chờ gọi API và render lại.
 * - Còn mới (dưới SSR_CACHE_SECONDS): trả luôn.
 * - Cũ hơn nhưng dưới 10 lần thời hạn: vẫn trả bản cũ ngay, render lại ở nền cho lượt sau (stale-while-revalidate).
 * - Admin sửa quán thì trang công khai cập nhật chậm tối đa chừng ấy giây.
 * Chỉ giữ trang 200 dạng HTML, tối đa CACHE_MAX_ENTRIES URL (bỏ URL lâu không dùng nhất).
 */
const CACHE_TTL_MS = Math.max(0, Number(process.env['SSR_CACHE_SECONDS'] ?? 60)) * 1000;
const CACHE_STALE_MS = CACHE_TTL_MS * 10;
const CACHE_MAX_ENTRIES = 300;

interface CachedPage {
  status: number;
  headers: [string, string][];
  body: string;
  at: number;
}
const htmlCache = new Map<string, CachedPage>();
/** URL đang render ở nền: không render trùng */
const refreshing = new Set<string>();

function cacheKey(req: express.Request): string {
  return `${(req.get('x-forwarded-host') ?? req.get('host') ?? '').toLowerCase()}${req.originalUrl}`;
}

/** Render một trang; trả về bản để giữ trong cache (null = không phải trang HTML 200, không giữ) */
async function render(req: express.Request): Promise<CachedPage | Response | null> {
  const response = await angularApp.handle(req);
  if (!response) return null;
  const type = response.headers.get('content-type') ?? '';
  if (response.status !== 200 || !type.includes('text/html') || response.headers.has('set-cookie')) return response;
  return { status: response.status, headers: [...response.headers.entries()], body: await response.text(), at: Date.now() };
}

function remember(key: string, page: CachedPage): void {
  htmlCache.delete(key);
  htmlCache.set(key, page);
  if (htmlCache.size > CACHE_MAX_ENTRIES) htmlCache.delete(htmlCache.keys().next().value!);
}

function send(res: express.Response, page: CachedPage, state: 'HIT' | 'STALE' | 'MISS'): void {
  for (const [name, value] of page.headers) {
    if (name !== 'content-length') res.setHeader(name, value);
  }
  res.setHeader('X-SSR-Cache', state);
  res.status(page.status).send(page.body);
}

app.use(async (req, res, next) => {
  try {
    // Chạy thật luôn là https (Render chuyển http → https): không để "X-Forwarded-Proto: http" tự gửi làm link
    // canonical thành http:// rồi bị giữ trong cache cho mọi người
    if (canonicalHost) req.headers['x-forwarded-proto'] = 'https';
    // Angular gặp X-Forwarded-* ngoài trustProxyHeaders (Render luôn gửi X-Forwarded-For) thì bỏ render, trả
    // khung trống, và khung đó bị giữ trong cache: bỏ các header này trước khi render
    for (const name of Object.keys(req.headers)) {
      if (name.startsWith('x-forwarded-') && name !== 'x-forwarded-host' && name !== 'x-forwarded-proto') {
        delete req.headers[name];
      }
    }
    if (req.method !== 'GET' || CACHE_TTL_MS === 0) {
      const response = await angularApp.handle(req);
      return response ? writeResponseToNodeResponse(response, res) : next();
    }
    const key = cacheKey(req);
    const cached = htmlCache.get(key);
    const age = cached ? Date.now() - cached.at : Infinity;
    if (cached && age < CACHE_TTL_MS) return send(res, cached, 'HIT');
    if (cached && age < CACHE_STALE_MS) {
      send(res, cached, 'STALE');
      if (!refreshing.has(key)) {
        refreshing.add(key);
        render(req)
          .then((page) => page && !(page instanceof Response) && remember(key, page))
          .catch(() => undefined)
          .finally(() => refreshing.delete(key));
      }
      return;
    }
    const page = await render(req);
    if (!page) return next();
    if (page instanceof Response) return writeResponseToNodeResponse(page, res);
    remember(key, page);
    send(res, page, 'MISS');
  } catch (err) {
    next(err);
  }
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
