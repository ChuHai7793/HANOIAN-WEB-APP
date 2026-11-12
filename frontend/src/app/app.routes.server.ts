import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Trang nào render HTML trên server (bản SSR):
 * - Client: trang cá nhân / cần đăng nhập (liệt kê tường minh). Server chỉ trả khung trống, trình duyệt tự dựng
 *   như bản static, nên server không bao giờ cần biết người dùng là ai.
 * - Server (mọi đường dẫn còn lại): trang công khai cần Google / Zalo đọc được (trang chủ, danh mục, hub theo loại /
 *   khu vực, trang quán, Cẩm nang, quiz, Autoplan, plan chia sẻ) và trang 404 (trả đúng mã 404).
 */
const CLIENT_ONLY = [
  'login',
  'register',
  'onboarding',
  'places',
  'cafes',
  'bars',
  'restaurants',
  'girlfriends',
  'girlfriends/:id',
  'dating',
  'dating/matches/:id',
  'plans',
  'plans/:id',
  'profile',
  'admin/articles',
  'admin/articles/:id',
  'admin/dating',
  'admin/users',
  'admin/users/:id',
];

export const serverRoutes: ServerRoute[] = [
  ...CLIENT_ONLY.map((path): ServerRoute => ({ path, renderMode: RenderMode.Client })),
  { path: '**', renderMode: RenderMode.Server },
];
