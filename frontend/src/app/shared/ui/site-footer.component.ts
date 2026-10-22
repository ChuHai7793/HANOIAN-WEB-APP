import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

/** Chân trang (trang chủ): logo, câu giới thiệu, ba cột link tới các trang đang có; không link tới trang chưa làm */
@Component({
  selector: 'app-site-footer',
  imports: [RouterLink],
  template: `
    <!-- Nền tối ở cả hai chế độ (màu đặt cứng, không theo bảng màu slate) -->
    <footer class="mt-4 rounded-[22px] bg-[#1e1b2e] px-5 py-8 text-[#c9c4dc] sm:px-8">
      <div class="grid gap-8 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <a routerLink="/" class="inline-flex items-center gap-2" aria-label="Trang chủ HANOIVIBE">
            <img src="logo.png" alt="" class="h-8 w-auto" />
            <span class="text-lg font-extrabold tracking-wide text-white"
              >HANOI<span class="text-[#b9a5f3]">VIBE</span></span
            >
          </a>
          <p class="mt-3 max-w-xs text-sm leading-relaxed text-[#a39dba]">
            Quán cafe, quán ăn, bar và chỗ chơi cho buổi hẹn ở Hà Nội. Chọn kiểu hẹn, lập plan, tìm
            người đi cùng.
          </p>
        </div>
        <nav aria-label="Khám phá">
          <p class="text-xs font-bold uppercase tracking-wider text-white">Khám phá</p>
          <ul class="mt-3 space-y-2 text-sm">
            <li><a routerLink="/explore" class="hover:text-white">Khám phá quán</a></li>
            <li><a routerLink="/spots" class="hover:text-white">Tìm chỗ chơi</a></li>
            <li><a routerLink="/cam-nang" class="hover:text-white">Cẩm nang hẹn hò</a></li>
            <li><a routerLink="/quiz" class="hover:text-white">Gu hẹn hò của bạn</a></li>
          </ul>
        </nav>
        <nav aria-label="Hẹn hò">
          <p class="text-xs font-bold uppercase tracking-wider text-white">Hẹn hò</p>
          <ul class="mt-3 space-y-2 text-sm">
            <li><a routerLink="/autoplan" class="hover:text-white">Autoplan buổi hẹn</a></li>
            <li><a routerLink="/dating" class="hover:text-white">Tìm đối tượng</a></li>
            <li><a routerLink="/plans" class="hover:text-white">Plan của tôi</a></li>
            <li><a routerLink="/places" class="hover:text-white">My place</a></li>
          </ul>
        </nav>
        <nav aria-label="Tài khoản">
          <p class="text-xs font-bold uppercase tracking-wider text-white">Tài khoản</p>
          <ul class="mt-3 space-y-2 text-sm">
            @if (auth.isLoggedIn()) {
              <li><a routerLink="/profile" class="hover:text-white">Hồ sơ của tôi</a></li>
              <li><a routerLink="/girlfriends" class="hover:text-white">Người yêu</a></li>
            } @else {
              <li><a routerLink="/register" class="hover:text-white">Tạo tài khoản</a></li>
              <li><a routerLink="/login" class="hover:text-white">Đăng nhập</a></li>
            }
          </ul>
        </nav>
        <!-- Cột "Theo dõi" (Facebook, Instagram, TikTok): tạm ẩn cho tới khi có link -->
      </div>
      <div
        class="mt-7 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4 text-xs text-[#a39dba]"
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
