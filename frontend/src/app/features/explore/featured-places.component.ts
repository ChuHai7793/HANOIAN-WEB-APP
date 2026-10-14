import { Component, input, output } from '@angular/core';
import { CatalogItem, FeaturedItem } from '../../core/models/catalog.model';
import { ratingText } from '../../core/models/review.model';
import { IconComponent } from '../../shared/ui/icon.component';

const TYPE_LABELS: Record<string, string> = { cafe: 'Cafe', bar: 'Bar', restaurant: 'Quán ăn' };

/**
 * "Điểm hẹn nổi bật" ở đầu Khám phá quán: tối đa 3 quán admin chọn (1 thẻ lớn + 2 thẻ nhỏ), ảnh tối dần,
 * dòng nhỏ, loại · quận, câu dẫn lớn, tên quán · ★. Bấm thẻ mở popup chi tiết quán.
 */
@Component({
  selector: 'app-featured-places',
  imports: [IconComponent],
  template: `
    <!-- Điện thoại: vuốt ngang; màn rộng: lưới (thẻ đầu rộng hơn) -->
    <div class="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 md:mx-0 md:grid md:gap-4 md:overflow-visible md:px-0 md:pb-0" [class]="gridClass()">
      @for (f of items(); track f.position; let first = $first) {
        <button
          type="button"
          class="group relative block h-[230px] w-[85%] shrink-0 snap-start overflow-hidden rounded-2xl text-left md:h-[290px] md:w-auto"
          [attr.aria-label]="'Xem ' + f.place.name"
          (click)="open.emit(f.place)"
        >
          @if (f.place.imageUrl) {
            <img [src]="f.place.imageUrl" alt="" class="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
          } @else {
            <span class="absolute inset-0 bg-gradient-to-br from-brand-500 to-brand-800"></span>
          }
          <span class="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10"></span>
          @if (f.kicker) {
            <span class="absolute inset-x-5 top-4 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-white/90 sm:inset-x-6 sm:top-5 sm:text-[13px]">
              @if (first) {
                <span class="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
              }
              {{ f.kicker }}
            </span>
          }
          <span class="absolute inset-x-5 bottom-4 block pr-12 sm:inset-x-6 sm:bottom-5">
            <span class="block text-[12px] font-semibold uppercase tracking-[0.14em] text-white/75 sm:text-[13px]">{{ typeLabel(f.place) }} · {{ f.place.districtLabel }}</span>
            <span class="mt-1 block whitespace-pre-line font-bold leading-tight text-white" [class]="first ? 'text-[24px] md:text-[34px]' : 'text-[22px] md:text-[24px]'">{{ f.headline }}</span>
            <span class="mt-2 block text-sm text-white/85">
              {{ f.place.name }}
              @if (f.place.ratingCount && f.place.ratingAvg !== null) {
                · <span class="text-amber-300">★</span> {{ rating(f.place.ratingAvg) }}
              }
            </span>
          </span>
          <span class="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-800 transition group-hover:bg-white sm:bottom-5 sm:right-5 sm:h-11 sm:w-11">
            <span class="-rotate-45"><app-icon name="arrowRight" [size]="16" [stroke]="2.2" /></span>
          </span>
        </button>
      }
    </div>
  `,
})
export class FeaturedPlacesComponent {
  readonly items = input.required<FeaturedItem[]>();
  readonly open = output<CatalogItem>();

  protected readonly rating = ratingText;

  /** 3 thẻ: thẻ đầu rộng hơn; 2 thẻ: chia đôi; 1 thẻ: cả hàng */
  protected gridClass(): string {
    const n = this.items().length;
    return n >= 3 ? 'md:grid-cols-[1.45fr_1fr_1fr]' : n === 2 ? 'md:grid-cols-[1.45fr_1fr]' : '';
  }

  protected typeLabel(p: CatalogItem): string {
    return TYPE_LABELS[p.type] ?? p.type;
  }
}
