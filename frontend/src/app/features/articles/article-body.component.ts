import { Component, computed, inject, input, OnInit, signal, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { marked } from 'marked';
import { ArticleBlock, splitArticle } from '../../core/models/article.model';
import { PLACE_LABELS } from '../../core/models/place.model';
import { ratingText } from '../../core/models/review.model';
import { spotCategory } from '../../core/models/spot.model';
import { CatalogService } from '../../core/services/catalog.service';
import { SpotService } from '../../core/services/spot.service';
import { IconComponent } from '../../shared/ui/icon.component';

interface EmbedCard {
  path: string;
  name: string;
  meta: string;
  address: string;
  image: string | null;
  rating: string | null;
}

/** Thẻ quán / chỗ chơi chèn trong bài viết ([[quan:slug]]): ảnh, tên, loại · quận, ★, link sang trang riêng */
@Component({
  selector: 'app-venue-embed',
  imports: [RouterLink, IconComponent],
  template: `
    @if (card(); as c) {
      <a [routerLink]="c.path" class="not-prose my-5 flex gap-4 overflow-hidden rounded-2xl border border-brand-100 bg-white p-3 shadow-sm transition hover:border-brand-300 hover:shadow">
        @if (c.image) {
          <img [src]="c.image" [alt]="c.name" class="h-28 w-36 shrink-0 rounded-xl object-cover sm:h-32 sm:w-44" loading="lazy" />
        }
        <span class="flex min-w-0 flex-col justify-center gap-1">
          <span class="text-[12px] font-semibold uppercase tracking-[0.12em] text-brand-600">{{ c.meta }}</span>
          <span class="text-lg font-bold leading-snug text-slate-900">{{ c.name }}</span>
          @if (c.rating) {
            <span class="text-sm text-slate-700"><span class="text-[#E29A2D]">★</span> {{ c.rating }}</span>
          }
          <span class="truncate text-sm text-slate-500">{{ c.address }}</span>
          <span class="mt-1 flex items-center gap-1 text-sm font-semibold text-brand-700">Xem chi tiết<app-icon name="arrowRight" [size]="14" [stroke]="2.4" /></span>
        </span>
      </a>
    } @else if (missing()) {
      <p class="not-prose my-4 rounded-xl border border-dashed border-rose-200 px-4 py-3 text-sm text-rose-600">Không tìm thấy {{ kind() === 'place' ? 'quán' : 'chỗ chơi' }} "{{ slug() }}".</p>
    }
  `,
})
export class VenueEmbedComponent implements OnInit {
  private readonly catalog = inject(CatalogService);
  private readonly spots = inject(SpotService);

  readonly kind = input.required<'place' | 'spot'>();
  readonly slug = input.required<string>();
  protected readonly card = signal<EmbedCard | null>(null);
  protected readonly missing = signal(false);

  async ngOnInit(): Promise<void> {
    try {
      if (this.kind() === 'place') {
        const p = await this.catalog.bySlug(this.slug());
        this.card.set({
          path: '/quan/' + p.slug,
          name: p.name,
          meta: `${PLACE_LABELS[p.type]} · ${p.districtLabel}`,
          address: p.address,
          image: p.imageUrl || null,
          rating: p.ratingCount && p.ratingAvg !== null ? `${ratingText(p.ratingAvg)} (${p.ratingCount} đánh giá)` : null,
        });
      } else {
        const s = await this.spots.bySlug(this.slug());
        this.card.set({
          path: '/cho-choi/' + s.slug,
          name: s.name,
          meta: `${spotCategory(s.category).label} · ${s.districtLabel}`,
          address: s.address,
          image: s.imageUrl || null,
          rating: s.ratingCount && s.ratingAvg !== null ? `${ratingText(s.ratingAvg)} (${s.ratingCount} đánh giá)` : null,
        });
      }
    } catch {
      this.missing.set(true);
    }
  }
}

/**
 * Thân bài Cẩm nang: Markdown (tiêu đề, đậm, danh sách, link, ảnh) và thẻ quán / chỗ chơi. HTML từ Markdown đi qua
 * bộ lọc mặc định của Angular ([innerHTML]) nên không chèn được script.
 */
@Component({
  selector: 'app-article-body',
  imports: [VenueEmbedComponent],
  // HTML từ [innerHTML] không mang thuộc tính _ngcontent nên style đóng gói không chạm tới; mọi luật đã nằm
  // dưới .article-prose nên để toàn cục vẫn an toàn.
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="article-prose">
      @for (b of blocks(); track $index) {
        @if (b.kind === 'markdown') {
          <div class="md" [innerHTML]="html(b.text)"></div>
        } @else {
          <app-venue-embed [kind]="b.kind" [slug]="b.slug" />
        }
      }
    </div>
  `,
  styles: `
    .article-prose { font-size: 16px; line-height: 1.75; color: rgb(51 65 85); }
    .article-prose .md :is(h2) { margin: 2rem 0 0.75rem; font-size: 1.5rem; font-weight: 800; line-height: 1.3; color: rgb(15 23 42); }
    .article-prose .md :is(h3) { margin: 1.5rem 0 0.5rem; font-size: 1.2rem; font-weight: 700; color: rgb(15 23 42); }
    .article-prose .md :is(p) { margin: 0.9rem 0; }
    .article-prose .md :is(ul, ol) { margin: 0.9rem 0; padding-left: 1.4rem; }
    .article-prose .md ul { list-style: disc; }
    .article-prose .md ol { list-style: decimal; }
    .article-prose .md li { margin: 0.25rem 0; }
    .article-prose .md a { color: rgb(90 62 192); font-weight: 600; text-decoration: underline; }
    .article-prose .md strong { color: rgb(15 23 42); }
    .article-prose .md blockquote { margin: 1rem 0; border-left: 4px solid rgb(213 200 248); padding: 0.25rem 1rem; color: rgb(71 85 105); font-style: italic; }
    .article-prose .md img { margin: 1rem 0; border-radius: 1rem; max-width: 100%; }
    .article-prose .md hr { margin: 2rem 0; border-color: rgb(226 232 240); }
  `,
})
export class ArticleBodyComponent {
  readonly body = input('');
  protected readonly blocks = computed<ArticleBlock[]>(() => splitArticle(this.body()));

  protected html(text: string): string {
    return marked.parse(text, { async: false, gfm: true, breaks: true }) as string;
  }
}
