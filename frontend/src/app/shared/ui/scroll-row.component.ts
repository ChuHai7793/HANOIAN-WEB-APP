import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { IconComponent } from './icon.component';

/**
 * Hàng ô trượt ngang (trang chủ: kiểu hẹn, khu vực): nội dung do trang cha đưa vào, mỗi ô tự đặt bề rộng.
 * Màn rộng có nút ‹ › hai bên và chấm trang bên dưới; điện thoại vuốt. Thẻ dừng ngay ngắn (scroll snap).
 */
@Component({
  selector: 'app-scroll-row',
  imports: [IconComponent],
  template: `
    <div class="relative">
      <div
        #track
        class="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
        (scroll)="measure()"
      >
        <ng-content />
      </div>
      @if (pages() > 1) {
        <button
          type="button"
          class="absolute left-0 top-1/2 hidden h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-md transition hover:bg-white disabled:pointer-events-none disabled:opacity-0 md:flex"
          aria-label="Trước"
          [disabled]="page() === 0"
          (click)="go(-1)"
        >
          <span class="rotate-180"><app-icon name="arrowRight" [size]="18" [stroke]="2.2" /></span>
        </button>
        <button
          type="button"
          class="absolute right-0 top-1/2 hidden h-11 w-11 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-md transition hover:bg-white disabled:pointer-events-none disabled:opacity-0 md:flex"
          aria-label="Tiếp"
          [disabled]="page() >= pages() - 1"
          (click)="go(1)"
        >
          <app-icon name="arrowRight" [size]="18" [stroke]="2.2" />
        </button>
        <div class="mt-3 flex justify-center gap-1.5" aria-hidden="true">
          @for (p of dots(); track p) {
            <span
              class="h-2 w-2 rounded-full transition"
              [class]="p === page() ? 'bg-brand-600' : 'bg-slate-300'"
            ></span>
          }
        </div>
      }
    </div>
  `,
})
export class ScrollRowComponent {
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  /** Số "trang" (mỗi trang = một khung nhìn) và trang đang xem */
  protected readonly pages = signal(1);
  protected readonly page = signal(0);
  protected readonly dots = computed(() => Array.from({ length: this.pages() }, (_, i) => i));

  constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      this.measure();
      // Ô bên trong đổi kích thước (ảnh tải xong, cửa sổ đổi cỡ): đo lại
      const ro = new ResizeObserver(() => this.measure());
      ro.observe(this.track().nativeElement);
      destroy.onDestroy(() => ro.disconnect());
    });
  }

  @HostListener('window:resize')
  protected measure(): void {
    const el = this.track().nativeElement;
    const width = el.clientWidth || 1;
    this.pages.set(Math.max(1, Math.ceil((el.scrollWidth - 1) / width)));
    this.page.set(Math.min(this.pages() - 1, Math.round(el.scrollLeft / width)));
  }

  protected go(dir: 1 | -1): void {
    const el = this.track().nativeElement;
    el.scrollBy({ left: dir * el.clientWidth, behavior: 'smooth' });
  }
}
