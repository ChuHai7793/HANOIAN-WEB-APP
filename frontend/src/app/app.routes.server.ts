import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Trang nào render HTML trên server (bản SSR):
 * - Server: trang công khai cần Google / Zalo đọc được (danh mục quán, chỗ chơi, quiz, plan chia sẻ).
 * - Client: trang cá nhân / cần đăng nhập. Server chỉ trả khung trống, trình duyệt tự dựng như bản static,
 *   nên server không bao giờ cần biết người dùng là ai.
 */
export const serverRoutes: ServerRoute[] = [
  { path: 'explore', renderMode: RenderMode.Server },
  { path: 'spots', renderMode: RenderMode.Server },
  { path: 'quiz', renderMode: RenderMode.Server },
  { path: 'p/:token', renderMode: RenderMode.Server },
  { path: '**', renderMode: RenderMode.Client },
];
