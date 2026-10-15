/**
 * Cloudflare Web Analytics: đếm lượt truy cập ẩn danh (không cookie). Xem docs/cloudfare/web-analytics.md.
 * Token không bí mật (vốn nằm công khai trong HTML). Mỗi tên miền có thể có site / token riêng trên Cloudflare;
 * tên miền chưa khai báo dùng token mặc định (cùng một site, lọc theo Host trên dashboard).
 */
const TOKENS: Record<string, string> = {
  'datingmaster.onrender.com': '05b6b9e234b745e6b9abed672df46bb1',
};
const DEFAULT_TOKEN = TOKENS['datingmaster.onrender.com'];

/** Chạy app trên máy thì không đếm, để số liệu chỉ phản ánh người dùng thật */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

/** Gọi một lần khi app chạy trên trình duyệt (main.ts). */
export function loadAnalytics(host: string = location.hostname, doc: Document = document): void {
  if (LOCAL_HOSTS.has(host) || host.endsWith('.local')) return;
  const token = TOKENS[host] ?? DEFAULT_TOKEN;
  if (!token || doc.querySelector('script[data-cf-beacon]')) return;
  const script = doc.createElement('script');
  script.defer = true;
  script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  script.setAttribute('data-cf-beacon', JSON.stringify({ token }));
  doc.head.appendChild(script);
}
