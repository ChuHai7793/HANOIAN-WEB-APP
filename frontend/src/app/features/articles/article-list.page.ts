import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ArticleSummary, dateText } from '../../core/models/article.model';
import { SeoService } from '../../core/seo/seo.service';
import { ArticleService } from '../../core/services/article.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { listPager, PagerComponent } from '../../shared/ui/pager.component';

/** Cẩm nang (/cam-nang): danh sách bài viết đã xuất bản, mới nhất trước. Render trên server cho SEO. */
@Component({
  selector: 'app-article-list-page',
  imports: [RouterLink, IconComponent, PagerComponent],
  template: `
    <div class="mx-auto flex max-w-6xl flex-col gap-6 px-4 pb-12 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <header id="danh-sach" class="flex scroll-mt-4 flex-wrap items-end justify-between gap-4">
        <div>
          <p class="flex items-center gap-3 text-[12px] font-bold uppercase tracking-[0.2em] text-brand-600"><span class="h-px w-7 bg-brand-500"></span>Cẩm nang hẹn hò</p>
          <h1 class="mt-2 text-[30px] font-extrabold leading-tight tracking-tight text-slate-900 sm:text-[38px]">Hẹn ở đâu, đi chơi gì ở Hà Nội.</h1>
          <p class="mt-1 text-[15px] text-slate-500">Danh sách quán, lịch trình và mẹo cho mọi kiểu buổi hẹn.</p>
        </div>
        @if (canEdit()) {
          <a routerLink="/admin/articles" class="flex h-9 items-center gap-1.5 rounded-full bg-brand-600 px-4 text-[13px] font-semibold text-white hover:bg-brand-700">
            <app-icon name="plus" [size]="14" [stroke]="2.4" />Quản lý bài viết
          </a>
        }
      </header>

      @if (items().length) {
        <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          @for (a of items(); track a.id; let first = $first) {
            <a [routerLink]="['/cam-nang', a.slug]" class="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" [class.lg:col-span-2]="first" [class.sm:col-span-2]="first">
              <div class="relative overflow-hidden bg-brand-100" [class]="first ? 'aspect-[16/8]' : 'aspect-[16/10]'">
                @if (a.coverUrl) {
                  <img [src]="a.coverUrl" [alt]="a.title" class="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                }
              </div>
              <div class="flex flex-1 flex-col gap-1.5 p-4">
                <p class="text-xs text-slate-500">{{ date(a.publishedAt) }}@if (a.venueCount) {<span class="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-800">{{ a.venueCount }} điểm hẹn</span>}</p>
                <h2 class="font-bold leading-snug text-slate-900 group-hover:text-brand-700" [class]="first ? 'text-2xl' : 'text-lg'">{{ a.title }}</h2>
                @if (a.excerpt) {
                  <p class="line-clamp-3 text-sm text-slate-600">{{ a.excerpt }}</p>
                }
              </div>
            </a>
          }
        </div>
        <app-pager [page]="pager.page()" [total]="total()" unit="bài" (pageChange)="goPage($event)" />
      } @else if (!loading()) {
        <p class="rounded-2xl border border-dashed border-brand-200 bg-white px-6 py-14 text-center text-sm text-slate-500">Sắp có bài viết đầu tiên. Quay lại sau nhé!</p>
      }
    </div>
  `,
})
export class ArticleListPage implements OnInit, OnDestroy {
  private readonly api = inject(ArticleService);
  private readonly seo = inject(SeoService);
  protected readonly canEdit = inject(AuthService).canEdit;

  protected readonly items = signal<ArticleSummary[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  /** Trang đang xem (?trang=), mỗi trang 20 bài */
  protected readonly pager = listPager('danh-sach');

  async ngOnInit(): Promise<void> {
    this.seo.set({
      title: 'Cẩm nang hẹn hò Hà Nội: quán, chỗ chơi, lịch trình',
      description: 'Đi đâu hẹn hò ở Hà Nội? Danh sách quán cafe, bar, nhà hàng, chỗ chơi và lịch trình gợi ý cho mọi kiểu buổi hẹn.',
      path: '/cam-nang',
      jsonLd: { '@context': 'https://schema.org', '@type': 'Blog', name: 'Cẩm nang hẹn hò HANOIVIBE', url: this.seo.absolute('/cam-nang') },
    });
    await this.load();
  }

  ngOnDestroy(): void {
    this.seo.clear();
  }

  protected date(iso: string | null): string {
    return dateText(iso);
  }

  protected async goPage(n: number): Promise<void> {
    this.pager.go(n);
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.api.list(this.pager.page() - 1, this.pager.size);
      // ?trang= vượt quá số trang: lùi về trang cuối
      if (!res.items.length && res.total && this.pager.page() > 1) {
        this.pager.clamp(res.total);
        return this.load();
      }
      this.items.set(res.items);
      this.total.set(res.total);
    } finally {
      this.loading.set(false);
    }
  }
}
