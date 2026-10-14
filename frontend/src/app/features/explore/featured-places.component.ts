import { afterNextRender, afterRenderEffect, Component, DestroyRef, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { CatalogItem, FeaturedItem } from '../../core/models/catalog.model';
import { ratingText } from '../../core/models/review.model';
import { IconComponent } from '../../shared/ui/icon.component';

const TYPE_LABELS: Record<string, string> = { cafe: 'Cafe', bar: 'Bar', restaurant: 'Quán ăn' };
/** Kéo quá chừng này (px) thì coi là kéo, không phải bấm mở quán */
const DRAG_THRESHOLD = 6;

/**
 * "Điểm hẹn nổi bật" ở đầu Khám phá quán: tối đa 6 quán admin chọn, xếp thành một hàng ngang trượt được.
 * Màn rộng ~3 thẻ / khung, máy tính bảng ~2, điện thoại ~1,2. Xem tiếp bằng nút ‹ ›, giữ chuột rồi kéo, vuốt
 * hoặc lăn ngang; thẻ dừng ngay ngắn (scroll snap). Bấm thẻ (không kéo) mở popup chi tiết quán.
 */
@Component({
  selector: 'app-featured-places',
  imports: [IconComponent],
  template: `
    <div class="relative">
      <div
        #track
        class="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
        [class.cursor-grab]="canScroll()"
        [class.!cursor-grabbing]="dragging()"
        [class.!snap-none]="dragging()"
        [class.!scroll-auto]="dragging()"
        (pointerdown)="dragStart($event)"
        (scroll)="updateArrows()"
      >
        @for (f of items(); track f.position) {
          <button
            type="button"
            class="group relative block h-[230px] w-[82%] shrink-0 snap-start overflow-hidden rounded-2xl text-left sm:w-[calc((100%-1rem)/2)] md:h-[290px] xl:w-[calc((100%-2rem)/3)]"
            [attr.aria-label]="'Xem ' + f.place.name"
            (click)="onCardClick($event, f.place)"
            (dragstart)="$event.preventDefault()"
          >
            @if (f.place.imageUrl) {
              <img [src]="f.place.imageUrl" alt="" draggable="false" class="pointer-events-none absolute inset-0 h-full w-full select-none object-cover transition duration-500 group-hover:scale-105" />
            } @else {
              <span class="absolute inset-0 bg-gradient-to-br from-brand-500 to-brand-800"></span>
            }
            <span class="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10"></span>
            @if (f.kicker) {
              <span class="absolute inset-x-5 top-4 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-white/90 md:inset-x-6 md:top-5 md:text-[13px]">
                @if (f.position === 1) {
                  <span class="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
                }
                {{ f.kicker }}
              </span>
            }
            <span class="absolute inset-x-5 bottom-4 block pr-12 md:inset-x-6 md:bottom-5">
              <span class="block text-[12px] font-semibold uppercase tracking-[0.14em] text-white/75 md:text-[13px]">{{ typeLabel(f.place) }} · {{ f.place.districtLabel }}</span>
              <span class="mt-1 block whitespace-pre-line text-[22px] font-bold leading-tight text-white md:text-[26px]">{{ f.headline }}</span>
              <span class="mt-2 block text-sm text-white/85">
                {{ f.place.name }}
                @if (f.place.ratingCount && f.place.ratingAvg !== null) {
                  · <span class="text-amber-300">★</span> {{ rating(f.place.ratingAvg) }}
                }
              </span>
            </span>
            <span class="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-800 transition group-hover:bg-white md:bottom-5 md:right-5 md:h-11 md:w-11">
              <span class="-rotate-45"><app-icon name="arrowRight" [size]="16" [stroke]="2.2" /></span>
            </span>
          </button>
        }
      </div>

      <!-- Nút trượt: màn rộng (điện thoại vuốt) -->
      @if (canScroll()) {
        <button
          type="button"
          class="absolute left-0 top-1/2 hidden h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-md transition hover:bg-white disabled:pointer-events-none disabled:opacity-0 md:flex"
          aria-label="Quán nổi bật trước"
          [disabled]="atStart()"
          (click)="page(-1)"
        >
          <span class="rotate-180"><app-icon name="arrowRight" [size]="18" [stroke]="2.2" /></span>
        </button>
        <button
          type="button"
          class="absolute right-0 top-1/2 hidden h-11 w-11 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-md transition hover:bg-white disabled:pointer-events-none disabled:opacity-0 md:flex"
          aria-label="Quán nổi bật sau"
          [disabled]="atEnd()"
          (click)="page(1)"
        >
          <app-icon name="arrowRight" [size]="18" [stroke]="2.2" />
        </button>
      }
    </div>
  `,
})
export class FeaturedPlacesComponent {
  readonly items = input.required<FeaturedItem[]>();
  readonly open = output<CatalogItem>();

  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  protected readonly rating = ratingText;
  protected readonly canScroll = signal(false);
  protected readonly atStart = signal(true);
  protected readonly atEnd = signal(false);
  protected readonly dragging = signal(false);

  private dragX = 0;
  private dragScroll = 0;
  private moved = 0;

  constructor() {
    const destroyRef = inject(DestroyRef);
    // Chỉ trên trình duyệt: đo xem hàng có tràn ngang không, theo dõi khi đổi cỡ
    afterNextRender(() => {
      this.updateArrows();
      const observer = new ResizeObserver(() => requestAnimationFrame(() => this.updateArrows()));
      observer.observe(this.track().nativeElement);
      destroyRef.onDestroy(() => observer.disconnect());
    });
    // Danh sách đổi (admin vừa thêm / bớt quán): đo lại xem hàng có tràn ngang không
    afterRenderEffect(() => {
      this.items();
      this.updateArrows();
    });
  }

  protected typeLabel(p: CatalogItem): string {
    return TYPE_LABELS[p.type] ?? p.type;
  }

  /** Trượt gần một khung (số thẻ đang thấy) sang trái / phải; snap tự canh thẻ */
  protected page(direction: -1 | 1): void {
    const el = this.track().nativeElement;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: 'smooth' });
  }

  protected updateArrows(): void {
    const el = this.track().nativeElement;
    const max = el.scrollWidth - el.clientWidth;
    this.canScroll.set(max > 2);
    this.atStart.set(el.scrollLeft <= 2);
    this.atEnd.set(el.scrollLeft >= max - 2);
  }

  /** Giữ chuột rồi kéo ngang (cảm ứng dùng cuộn sẵn có của trình duyệt) */
  protected dragStart(e: PointerEvent): void {
    if (e.pointerType !== 'mouse' || e.button !== 0 || !this.canScroll()) return;
    const el = this.track().nativeElement;
    this.dragX = e.clientX;
    this.dragScroll = el.scrollLeft;
    this.moved = 0;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - this.dragX;
      this.moved = Math.max(this.moved, Math.abs(dx));
      if (this.moved > DRAG_THRESHOLD) this.dragging.set(true);
      el.scrollLeft = this.dragScroll - dx;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      // Bật lại snap để thẻ dừng ngay ngắn
      this.dragging.set(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  /** Vừa kéo xong thì không coi là bấm mở quán */
  protected onCardClick(e: MouseEvent, place: CatalogItem): void {
    if (this.moved > DRAG_THRESHOLD) {
      e.preventDefault();
      this.moved = 0;
      return;
    }
    this.open.emit(place);
  }
}
