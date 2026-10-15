import { afterNextRender, afterRenderEffect, Component, DestroyRef, ElementRef, inject, input, OnInit, output, signal, viewChild } from '@angular/core';
import { IconComponent } from './icon.component';

/** Một thẻ nổi bật (quán hoặc chỗ chơi), trang cha dựng từ dữ liệu của mình */
export interface FeaturedCard {
  /** id quán / chỗ chơi, trả lại qua (open) */
  id: string;
  position: number;
  /** Dòng nhỏ phía trên, vd. "Một chút bình yên" */
  kicker: string;
  /** Câu dẫn lớn, xuống dòng bằng \n */
  headline: string;
  imageUrl: string | null;
  /** Dòng nhỏ trên câu dẫn, vd. "Cafe · Ba Đình" */
  meta: string;
  name: string;
  /** Điểm đánh giá đã định dạng ("4,6"), null = chưa có */
  rating: string | null;
  /** Thông tin thêm sau tên, vd. giá "Từ 40k" */
  note: string | null;
}

/** Kéo quá chừng này (px) thì coi là kéo, không phải bấm mở */
const DRAG_THRESHOLD = 6;

/**
 * Khối "nổi bật" ở đầu Khám phá quán / Tìm chỗ chơi: tiêu đề, nút admin "Chọn gợi ý nổi bật", nút ẩn / hiện
 * (nhớ theo trình duyệt) và tối đa 6 thẻ admin chọn, xếp một hàng ngang trượt được. Màn rộng ~3 thẻ / khung,
 * máy tính bảng ~2, điện thoại ~1,2. Xem tiếp bằng nút ‹ ›, giữ chuột rồi kéo, vuốt hoặc lăn ngang; thẻ dừng
 * ngay ngắn (scroll snap). Bấm thẻ (không kéo) mở chi tiết.
 */
@Component({
  selector: 'app-featured-section',
  imports: [IconComponent],
  template: `
    @if (cards().length || canEdit()) {
      <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-medium">
        <h2 class="mr-auto text-lg font-bold tracking-tight text-slate-900">{{ heading() }}</h2>
        @if (canEdit()) {
          <button type="button" class="text-brand-700 hover:underline" (click)="edit.emit()">Chọn gợi ý nổi bật</button>
        }
        @if (cards().length) {
          <button type="button" class="flex items-center gap-1 text-slate-500 hover:text-slate-800" (click)="toggle()">
            {{ hidden() ? 'Hiện gợi ý nổi bật' : 'Ẩn gợi ý nổi bật' }}
            <span class="transition" [class.rotate-180]="!hidden()"><app-icon name="chevronDown" [size]="14" /></span>
          </button>
        }
      </div>
    }
    <div class="relative" [class.hidden]="!cards().length || hidden()">
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
        @for (f of cards(); track f.id) {
          <button
            type="button"
            class="group relative block h-[230px] w-[82%] shrink-0 snap-start overflow-hidden rounded-2xl text-left sm:w-[calc((100%-1rem)/2)] md:h-[290px] xl:w-[calc((100%-2rem)/3)]"
            [attr.aria-label]="'Xem ' + f.name"
            (click)="onCardClick($event, f.id)"
            (dragstart)="$event.preventDefault()"
          >
            @if (f.imageUrl) {
              <img [src]="f.imageUrl" alt="" draggable="false" class="pointer-events-none absolute inset-0 h-full w-full select-none object-cover transition duration-500 group-hover:scale-105" />
            } @else {
              <span class="absolute inset-0 bg-gradient-to-br from-brand-500 to-brand-800"></span>
            }
            <span class="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10"></span>
            <!-- Mép trên tối nhẹ: dòng chữ nhỏ vẫn đọc được trên ảnh sáng -->
            <span class="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/55 to-transparent"></span>
            @if (f.kicker) {
              <span class="absolute inset-x-5 top-4 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-white [text-shadow:0_1px_6px_rgb(0_0_0/0.45)] md:inset-x-6 md:top-5 md:text-[13px]">
                @if (f.position === 1) {
                  <span class="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
                }
                {{ f.kicker }}
              </span>
            }
            <span class="absolute inset-x-5 bottom-4 block pr-12 md:inset-x-6 md:bottom-5">
              <span class="block text-[12px] font-semibold uppercase tracking-[0.14em] text-white/75 md:text-[13px]">{{ f.meta }}</span>
              <span class="mt-1 block whitespace-pre-line text-[22px] font-bold leading-tight text-white md:text-[26px]">{{ f.headline }}</span>
              <span class="mt-2 block text-sm text-white/85">
                {{ f.name }}
                @if (f.rating) {
                  · <span class="text-amber-300">★</span> {{ f.rating }}
                }
                @if (f.note) {
                  · {{ f.note }}
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
          [attr.aria-label]="heading() + ' trước'"
          [disabled]="atStart()"
          (click)="page(-1)"
        >
          <span class="rotate-180"><app-icon name="arrowRight" [size]="18" [stroke]="2.2" /></span>
        </button>
        <button
          type="button"
          class="absolute right-0 top-1/2 hidden h-11 w-11 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-md transition hover:bg-white disabled:pointer-events-none disabled:opacity-0 md:flex"
          [attr.aria-label]="heading() + ' sau'"
          [disabled]="atEnd()"
          (click)="page(1)"
        >
          <app-icon name="arrowRight" [size]="18" [stroke]="2.2" />
        </button>
      }
    </div>
  `,
})
export class FeaturedSectionComponent implements OnInit {
  readonly heading = input.required<string>();
  readonly cards = input.required<FeaturedCard[]>();
  readonly canEdit = input(false);
  /** Khoá localStorage nhớ "ẩn gợi ý nổi bật" của trang */
  readonly storageKey = input.required<string>();
  readonly open = output<string>();
  readonly edit = output<void>();

  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  protected readonly hidden = signal(false);
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
    // Danh sách đổi (admin vừa thêm / bớt) hoặc vừa hiện lại: đo lại
    afterRenderEffect(() => {
      this.cards();
      this.hidden();
      this.updateArrows();
    });
  }

  ngOnInit(): void {
    try {
      this.hidden.set(localStorage.getItem(this.storageKey()) === '1');
    } catch {
      // Render trên server, ẩn danh / chặn lưu trữ: mặc định hiện
    }
  }

  protected toggle(): void {
    this.hidden.update((v) => !v);
    try {
      localStorage.setItem(this.storageKey(), this.hidden() ? '1' : '0');
    } catch {
      // Chỉ không nhớ được lựa chọn
    }
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

  /** Vừa kéo xong thì không coi là bấm mở */
  protected onCardClick(e: MouseEvent, id: string): void {
    if (this.moved > DRAG_THRESHOLD) {
      e.preventDefault();
      this.moved = 0;
      return;
    }
    this.open.emit(id);
  }
}
