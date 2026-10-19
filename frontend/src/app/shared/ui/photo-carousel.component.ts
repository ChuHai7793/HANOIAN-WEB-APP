import { Component, computed, effect, input, signal } from '@angular/core';
import { imageVariant } from '../../core/models/place.model';
import { IconComponent } from './icon.component';

/**
 * Xem nhiều ảnh: mũi tên mờ hai bên (rõ hơn khi rê chuột), chấm vị trí ở dưới, vuốt ngang trên điện thoại
 * (vuốt chéo / dọc là cuộn trang, không đổi ảnh). Bấm mũi tên / chấm không lan ra ngoài (không mở popup của thẻ).
 * Một ảnh thì chỉ hiện ảnh.
 *
 * `variants`: thẻ trong danh sách dùng bản thu nhỏ backend sinh sẵn (320 / 800px) qua srcset, trình duyệt chọn
 * theo bề rộng thẻ và mật độ điểm ảnh; ảnh chưa có bản nhỏ (ảnh cũ, link ngoài) tự quay về ảnh gốc.
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
        [attr.srcset]="srcset()"
        [attr.sizes]="srcset() ? sizes() : null"
        [alt]="alt()"
        class="relative h-full w-full select-none"
        [class]="contain() ? 'object-contain' : 'object-cover'"
        draggable="false"
        decoding="async"
        [attr.loading]="lazy() ? 'lazy' : null"
        (error)="onError()"
        (touchstart)="touchStart($event)"
        (touchend)="touchEnd($event)"
      />
      @if (photos().length > 1) {
        <button
          type="button"
          class="absolute left-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-white opacity-70 transition hover:opacity-100 group-hover/carousel:opacity-100"
          aria-label="Ảnh trước"
          (click)="go(-1, $event)"
          (keydown.enter)="$event.stopPropagation()"
        >
          <span class="flex h-8 w-8 rotate-180 items-center justify-center rounded-full bg-black/30 backdrop-blur-[2px]"><app-icon name="arrowRight" [size]="16" [stroke]="2.4" /></span>
        </button>
        <button
          type="button"
          class="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-white opacity-70 transition hover:opacity-100 group-hover/carousel:opacity-100"
          aria-label="Ảnh sau"
          (click)="go(1, $event)"
          (keydown.enter)="$event.stopPropagation()"
        >
          <span class="flex h-8 w-8 items-center justify-center rounded-full bg-black/30 backdrop-blur-[2px]"><app-icon name="arrowRight" [size]="16" [stroke]="2.4" /></span>
        </button>
        <!-- Chấm nhỏ nhưng vùng chạm mỗi chấm cao 24px -->
        <div class="absolute inset-x-0 bottom-0 flex justify-center" (click)="$event.stopPropagation()">
          @for (p of photos(); track $index) {
            <button
              type="button"
              class="flex h-6 min-w-5 items-center justify-center px-0.5"
              [attr.aria-label]="'Ảnh ' + ($index + 1)"
              [attr.aria-current]="$index === index()"
              (click)="index.set($index)"
            >
              <span class="h-1.5 rounded-full transition-all" [class]="$index === index() ? 'w-4 bg-white' : 'w-1.5 bg-white/60'"></span>
            </button>
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
  /** Dùng bản thu nhỏ (srcset) cho thẻ trong danh sách */
  readonly variants = input(false);
  /** Bề rộng hiển thị để trình duyệt chọn bản ảnh (thuộc tính sizes) */
  readonly sizes = input('(min-width: 40rem) 340px, calc(100vw - 2rem)');

  protected readonly index = signal(0);
  protected readonly current = computed(() => this.photos()[Math.min(this.index(), this.photos().length - 1)]);
  /** Ảnh mà bản thu nhỏ không tải được: dùng ảnh gốc */
  private readonly failed = signal<ReadonlySet<string>>(new Set());
  protected readonly srcset = computed(() => {
    const url = this.current();
    if (!this.variants() || !url || this.failed().has(url)) return null;
    const small = imageVariant(url, 320);
    const medium = imageVariant(url, 800);
    return small && medium ? `${small} 320w, ${medium} 800w, ${url} 1200w` : null;
  });
  private touchX: number | null = null;
  private touchY: number | null = null;
  /** So theo nội dung: mảng mới cùng ảnh không làm quay về ảnh đầu */
  private readonly key = computed(() => this.photos().join('|'));

  constructor() {
    // Đổi sang quán khác (cùng component) thì về ảnh đầu
    effect(() => {
      this.key();
      this.index.set(0);
    });
  }

  protected onError(): void {
    const url = this.current();
    if (!url || !this.srcset()) return;
    this.failed.update((s) => new Set(s).add(url));
  }

  protected go(delta: number, event?: Event): void {
    event?.stopPropagation();
    const n = this.photos().length;
    this.index.update((i) => (i + delta + n) % n);
  }

  protected touchStart(e: TouchEvent): void {
    this.touchX = e.touches[0]?.clientX ?? null;
    this.touchY = e.touches[0]?.clientY ?? null;
  }

  protected touchEnd(e: TouchEvent): void {
    if (this.touchX === null || this.touchY === null || this.photos().length < 2) return;
    const dx = (e.changedTouches[0]?.clientX ?? this.touchX) - this.touchX;
    const dy = (e.changedTouches[0]?.clientY ?? this.touchY) - this.touchY;
    this.touchX = this.touchY = null;
    // Chỉ nhận vuốt ngang rõ ràng; vuốt chéo là người dùng đang cuộn trang
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) this.go(dx < 0 ? 1 : -1);
  }
}
