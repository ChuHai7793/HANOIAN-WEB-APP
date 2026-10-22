import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

/** Chân trang (trang chủ): logo, câu giới thiệu, ba cột link tới các trang đang có; không link tới trang chưa làm */
@Component({
  selector: 'app-site-footer',
  imports: [RouterLink],
  template: `
    <footer class="mt-4 rounded-[22px] border border-slate-200 bg-white px-5 py-7 sm:px-8">
      <div class="grid gap-8 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <a routerLink="/" class="inline-flex items-center gap-2" aria-label="Trang chủ HANOIVIBE">
            <img src="logo.png" alt="" class="h-8 w-auto" />
            <span class="text-lg font-extrabold tracking-wide text-slate-900"
              >HANOI<span class="text-brand-600">VIBE</span></span
            >
          </a>
          <p class="mt-3 max-w-xs text-sm leading-relaxed text-slate-500">
            Quán cafe, quán ăn, bar và chỗ chơi cho buổi hẹn ở Hà Nội. Chọn kiểu hẹn, lập plan, tìm
            người đi cùng.
          </p>
        </div>
        <nav aria-label="Khám phá">
          <p class="text-xs font-bold uppercase tracking-wider text-slate-500">Khám phá</p>
          <ul class="mt-3 space-y-2 text-sm">
            <li>
              <a routerLink="/explore" class="text-slate-700 hover:text-brand-700">Khám phá quán</a>
            </li>
            <li>
              <a routerLink="/spots" class="text-slate-700 hover:text-brand-700">Tìm chỗ chơi</a>
            </li>
            <li>
              <a routerLink="/cam-nang" class="text-slate-700 hover:text-brand-700"
                >Cẩm nang hẹn hò</a
              >
            </li>
            <li>
              <a routerLink="/quiz" class="text-slate-700 hover:text-brand-700"
                >Gu hẹn hò của bạn</a
              >
            </li>
          </ul>
        </nav>
        <nav aria-label="Hẹn hò">
          <p class="text-xs font-bold uppercase tracking-wider text-slate-500">Hẹn hò</p>
          <ul class="mt-3 space-y-2 text-sm">
            <li>
              <a routerLink="/autoplan" class="text-slate-700 hover:text-brand-700"
                >Autoplan buổi hẹn</a
              >
            </li>
            <li>
              <a routerLink="/dating" class="text-slate-700 hover:text-brand-700">Tìm đối tượng</a>
            </li>
            <li>
              <a routerLink="/plans" class="text-slate-700 hover:text-brand-700">Plan của tôi</a>
            </li>
            <li>
              <a routerLink="/places" class="text-slate-700 hover:text-brand-700">My place</a>
            </li>
          </ul>
        </nav>
        <nav aria-label="Tài khoản">
          <p class="text-xs font-bold uppercase tracking-wider text-slate-500">Tài khoản</p>
          <ul class="mt-3 space-y-2 text-sm">
            @if (auth.isLoggedIn()) {
              <li>
                <a routerLink="/profile" class="text-slate-700 hover:text-brand-700"
                  >Hồ sơ của tôi</a
                >
              </li>
              <li>
                <a routerLink="/girlfriends" class="text-slate-700 hover:text-brand-700"
                  >Người yêu</a
                >
              </li>
            } @else {
              <li>
                <a routerLink="/register" class="text-slate-700 hover:text-brand-700"
                  >Tạo tài khoản</a
                >
              </li>
              <li>
                <a routerLink="/login" class="text-slate-700 hover:text-brand-700">Đăng nhập</a>
              </li>
            }
          </ul>
        </nav>
      </div>
      <div
        class="mt-7 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500"
      >
        <span>© {{ year }} HANOIVIBE</span>
        <span>Làm cho những buổi hẹn ở Hà Nội.</span>
      </div>
    </footer>
  `,
})
export class SiteFooterComponent {
  protected readonly auth = inject(AuthService);
  protected readonly year = new Date().getFullYear();
}
