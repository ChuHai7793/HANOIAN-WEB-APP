import { afterNextRender, Directive, ElementRef, inject, OnDestroy } from '@angular/core';

/** Cách mép dưới cửa sổ */
const BOTTOM_GAP = 10;
/** Màn hình quá thấp thì thẻ không nhỏ hơn mức này (khi đó phải cuộn); điện thoại thấp hơn */
const MIN_HEIGHT = 360;
const MIN_HEIGHT_PHONE = 300;

/**
 * Đặt trên lưới thẻ: tính chiều cao thẻ sao cho hàng thẻ đầu tiên vừa khít màn hình (cách mép dưới 10px),
 * hàng sau phải cuộn mới thấy. Ghi vào biến CSS `--row-h` của lưới; thẻ dùng `h-[var(--row-h)]`.
 * Tính lại khi đổi cỡ cửa sổ hoặc phần trên lưới cao / thấp đi (chip lọc xuống dòng, dữ liệu vừa tải…).
 */
@Directive({ selector: '[appFitRow]' })
export class FitRowDirective implements OnDestroy {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private observer: ResizeObserver | null = null;
  private frame = 0;
  private readonly update = () => {
    const top = this.el.getBoundingClientRect().top + window.scrollY;
    const min = window.innerWidth < 640 ? MIN_HEIGHT_PHONE : MIN_HEIGHT;
    const height = `${Math.max(min, Math.floor(window.innerHeight - top - BOTTOM_GAP))}px`;
    if (this.el.style.getPropertyValue('--row-h') !== height) this.el.style.setProperty('--row-h', height);
  };
  /** ResizeObserver: đổi --row-h ở khung hình sau, tránh lỗi "ResizeObserver loop" (vd. lúc thu gọn thanh bên) */
  private readonly scheduleUpdate = () => {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(this.update);
  };

  constructor() {
    afterNextRender(() => {
      this.update();
      window.addEventListener('resize', this.update);
      if (typeof ResizeObserver !== 'undefined') {
        this.observer = new ResizeObserver(this.scheduleUpdate);
        this.observer.observe(this.el.parentElement ?? this.el);
      }
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.update);
    this.observer?.disconnect();
    cancelAnimationFrame(this.frame);
  }
}
