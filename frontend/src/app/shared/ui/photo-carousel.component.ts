import { Component, computed, effect, input, signal } from '@angular/core';
import { IconComponent } from './icon.component';

/**
 * Xem nhiều ảnh: mũi tên mờ hai bên (rõ hơn khi rê chuột), chấm vị trí ở dưới, vuốt ngang trên điện thoại.
 * Bấm mũi tên / chấm không lan ra ngoài (không mở popup của thẻ). Một ảnh thì chỉ hiện ảnh.
 */
@Component({
  selector: 'app-photo-carousel',
  imports: [IconComponent],
  host: { class: 'group/carousel relative block overflow-hidden' },
  template: `
    @if (photos().length) {
      @if (backdrop()) {
        <!-- Nền: chính ảnh đó phóng to, làm mờ, để ảnh hiện trọn (contain) mà không lộ khoảng trống -->
        <img [src]="current()" alt="" aria-hidden="true" class="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" />
      }
      <img
        [src]="current()"
        [alt]="alt()"
        class="relative h-full w-full select-none"
        [class]="contain() ? 'object-contain' : 'object-cover'"
        draggable="false"
        [attr.loading]="lazy() ? 'lazy' : null"
        (touchstart)="touchStart($event)"
        (touchend)="touchEnd($event)"
      />
      @if (photos().length > 1) {
        <button
          type="button"
          class="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-white opacity-60 backdrop-blur-[2px] transition hover:bg-black/45 hover:opacity-100 group-hover/carousel:opacity-90"
          aria-label="Ảnh trước"
          (click)="go(-1, $event)"
          (keydown.enter)="$event.stopPropagation()"
        >
          <span class="rotate-180"><app-icon name="arrowRight" [size]="16" [stroke]="2.4" /></span>
        </button>
        <button
          type="button"
          class="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-white opacity-60 backdrop-blur-[2px] transition hover:bg-black/45 hover:opacity-100 group-hover/carousel:opacity-90"
          aria-label="Ảnh sau"
          (click)="go(1, $event)"
          (keydown.enter)="$event.stopPropagation()"
        >
          <app-icon name="arrowRight" [size]="16" [stroke]="2.4" />
        </button>
        <div class="absolute inset-x-0 bottom-2 flex justify-center gap-1.5" (click)="$event.stopPropagation()">
          @for (p of photos(); track $index) {
            <button
              type="button"
              class="h-1.5 rounded-full transition-all"
              [class]="$index === index() ? 'w-4 bg-white' : 'w-1.5 bg-white/60 hover:bg-white/90'"
              [attr.aria-label]="'Ảnh ' + ($index + 1)"
              [attr.aria-current]="$index === index()"
              (click)="index.set($index)"
            ></button>
          }
        </div>
      }
    }
  `,
})
export class PhotoCarouselComponent {
  readonly photos = input<string[]>([]);
  readonly alt = input('');
  /** Ảnh trên thẻ: tải khi cuộn tới; ảnh trong popup: tải ngay */
  readonly lazy = input(true);
  /** Hiện trọn ảnh (không cắt) */
  readonly contain = input(false);
  /** Dùng với contain: lấp khoảng trống quanh ảnh bằng chính ảnh làm mờ */
  readonly backdrop = input(false);

  protected readonly index = signal(0);
  protected readonly current = computed(() => this.photos()[Math.min(this.index(), this.photos().length - 1)]);
  private touchX: number | null = null;
  /** So theo nội dung: mảng mới cùng ảnh không làm quay về ảnh đầu */
  private readonly key = computed(() => this.photos().join('|'));

  constructor() {
    // Đổi sang quán khác (cùng component) thì về ảnh đầu
    effect(() => {
      this.key();
      this.index.set(0);
    });
  }

  protected go(delta: number, event?: Event): void {
    event?.stopPropagation();
    const n = this.photos().length;
    this.index.update((i) => (i + delta + n) % n);
  }

  protected touchStart(e: TouchEvent): void {
    this.touchX = e.touches[0]?.clientX ?? null;
  }

  protected touchEnd(e: TouchEvent): void {
    if (this.touchX === null || this.photos().length < 2) return;
    const dx = (e.changedTouches[0]?.clientX ?? this.touchX) - this.touchX;
    this.touchX = null;
    if (Math.abs(dx) > 40) this.go(dx < 0 ? 1 : -1);
  }
}
