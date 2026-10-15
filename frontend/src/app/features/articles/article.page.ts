import { Component, inject, input, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { errorCode } from '../../core/api/api';
import { AuthService } from '../../core/auth/auth.service';
import { Article, dateText } from '../../core/models/article.model';
import { SeoService } from '../../core/seo/seo.service';
import { ArticleService } from '../../core/services/article.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { ArticleBodyComponent } from './article-body.component';

/** Bài viết Cẩm nang (/cam-nang/:slug). Render trên server; JSON-LD dạng Article. */
@Component({
  selector: 'app-article-page',
  imports: [RouterLink, IconComponent, ArticleBodyComponent],
  template: `
    <div class="mx-auto flex max-w-3xl flex-col gap-5 px-4 pb-14 pt-4 sm:px-6 lg:pt-6">
      <nav class="text-[13px] text-slate-500" aria-label="Đường dẫn">
        <a routerLink="/cam-nang" class="hover:text-brand-700">Cẩm nang</a>
        @if (article(); as a) {
          <span class="mx-1.5 text-slate-300">/</span><span class="text-slate-800">{{ a.title }}</span>
        }
      </nav>

      @if (notFound()) {
        <div class="rounded-2xl border border-dashed border-brand-200 bg-white px-6 py-14 text-center text-sm text-slate-500">
          Không tìm thấy bài viết này. <a routerLink="/cam-nang" class="ml-1 font-semibold text-brand-700 hover:underline">Xem các bài khác</a>
        </div>
      } @else if (article(); as a) {
        <article>
          <header class="flex flex-col gap-3">
            <h1 class="text-[30px] font-extrabold leading-tight tracking-tight text-slate-900 sm:text-[40px]">{{ a.title }}</h1>
            <p class="flex flex-wrap items-center gap-x-3 text-sm text-slate-500">
              <span>{{ date(a.publishedAt) }}</span>
              @if (a.authorName) {
                <span>· {{ a.authorName }}</span>
              }
              @if (canEdit()) {
                <a [routerLink]="['/admin/articles', a.id]" class="flex items-center gap-1 font-semibold text-brand-700 hover:underline"><app-icon name="edit" [size]="14" />Sửa bài</a>
              }
            </p>
            @if (a.excerpt) {
              <p class="text-lg leading-relaxed text-slate-600">{{ a.excerpt }}</p>
            }
          </header>
          @if (a.coverUrl) {
            <img [src]="a.coverUrl" [alt]="a.title" class="my-6 aspect-[16/9] w-full rounded-2xl object-cover" />
          }
          <app-article-body [body]="a.body" />
        </article>

        <div class="mt-4 flex flex-col items-center gap-2 rounded-2xl bg-brand-50 px-6 py-6 text-center">
          <p class="font-semibold text-slate-900">Muốn một buổi hẹn như vậy?</p>
          <p class="text-sm text-slate-600">Chọn khu vực, Autoplan dựng sẵn lịch trình trong 10 giây.</p>
          <a routerLink="/autoplan" class="mt-1 flex min-h-10 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
            <app-icon name="shuffle" [size]="16" />Thử Autoplan
          </a>
        </div>
      } @else {
        <p class="text-sm text-slate-500">Đang tải…</p>
      }
    </div>
  `,
})
export class ArticlePage implements OnInit, OnDestroy {
  private readonly api = inject(ArticleService);
  private readonly seo = inject(SeoService);
  protected readonly canEdit = inject(AuthService).canEdit;

  readonly slug = input.required<string>();
  protected readonly article = signal<Article | null>(null);
  protected readonly notFound = signal(false);

  async ngOnInit(): Promise<void> {
    try {
      const a = await this.api.bySlug(this.slug());
      this.article.set(a);
      const path = '/cam-nang/' + a.slug;
      this.seo.set({
        title: a.title,
        description: a.excerpt || a.body.replace(/\[\[[^\]]+\]\]|[#*_>`\[\]()-]/g, ' ').slice(0, 160),
        image: a.coverUrl,
        path,
        type: 'article',
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: a.title,
          description: a.excerpt || undefined,
          image: a.coverUrl ? [this.seo.absolute(a.coverUrl)] : undefined,
          datePublished: a.publishedAt,
          dateModified: a.updatedAt,
          author: { '@type': 'Organization', name: 'HANOIVIBE' },
          publisher: { '@type': 'Organization', name: 'HANOIVIBE', logo: { '@type': 'ImageObject', url: this.seo.absolute('/logo.png') } },
          mainEntityOfPage: this.seo.absolute(path),
        },
      });
    } catch (err) {
      if (errorCode(err) === 'NOT_FOUND') {
        this.notFound.set(true);
        this.seo.notFound('Không tìm thấy bài viết', '/cam-nang/' + this.slug());
      }
    }
  }

  ngOnDestroy(): void {
    this.seo.clear();
  }

  protected date(iso: string | null): string {
    return dateText(iso);
  }
}
