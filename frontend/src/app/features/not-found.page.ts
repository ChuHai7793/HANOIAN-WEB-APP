import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SeoService } from '../core/seo/seo.service';
import { IconComponent } from '../shared/ui/icon.component';

/**
 * Đường dẫn không có (route `**`): trả đúng HTTP 404 + noindex khi render trên server, thay vì chuyển về trang chủ
 * với mã 200 (Google coi là "soft 404", trang trùng nội dung).
 */
@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink, IconComponent],
  template: `
    <div class="mx-auto flex max-w-2xl flex-col items-center gap-3 px-4 py-20 text-center">
      <span class="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 text-brand-600"><app-icon name="compass" [size]="32" /></span>
      <h1 class="text-2xl font-extrabold tracking-tight text-slate-900">Không tìm thấy trang này</h1>
      <p class="text-sm text-slate-500">Đường dẫn có thể đã đổi hoặc không còn. Thử một trong các trang dưới đây.</p>
      <nav class="mt-3 flex flex-wrap justify-center gap-2 text-sm font-semibold">
        <a routerLink="/" class="rounded-xl bg-brand-600 px-4 py-2.5 text-white hover:bg-brand-700">Trang chủ</a>
        <a routerLink="/explore" class="rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-slate-700 hover:bg-brand-50">Khám phá quán</a>
        <a routerLink="/spots" class="rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-slate-700 hover:bg-brand-50">Tìm chỗ chơi</a>
        <a routerLink="/cam-nang" class="rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-slate-700 hover:bg-brand-50">Cẩm nang</a>
      </nav>
    </div>
  `,
})
export class NotFoundPage implements OnInit, OnDestroy {
  private readonly seo = inject(SeoService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.seo.notFound('Không tìm thấy trang', this.router.url.split('?')[0]);
  }

  ngOnDestroy(): void {
    this.seo.clear();
  }
}
