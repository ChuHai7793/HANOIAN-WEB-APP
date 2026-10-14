import { Component, HostListener, input, output } from '@angular/core';
import { IconComponent } from './icon.component';
import { PhotoCarouselComponent } from './photo-carousel.component';

/**
 * Popup chi tiết quán / chỗ chơi, ở giữa màn hình. Màn rộng: cột trái chỉ có ảnh (hiện trọn, nền là chính ảnh làm
 * mờ, mũi tên mờ khi có nhiều ảnh), cột phải: tiêu đề + nội dung tự cuộn + hàng nút ({@code [modalFooter]}) ở dưới.
 * Điện thoại: ảnh ở trên, thông tin ở dưới. Không có ảnh: chỉ cột thông tin (popup hẹp lại).
 */
@Component({
  selector: 'app-detail-modal',
  imports: [IconComponent, PhotoCarouselComponent],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" (click)="dismiss.emit()"></div>

      <div
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title()"
        class="relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        [class]="photos().length ? 'max-w-5xl md:h-[min(86vh,720px)] md:flex-row' : 'max-w-lg'"
      >
        @if (photos().length) {
          <app-photo-carousel
            class="h-60 w-full shrink-0 bg-slate-900 sm:h-72 md:h-full md:w-[52%]"
            [photos]="photos()"
            [alt]="title()"
            [lazy]="false"
            [contain]="true"
            [backdrop]="true"
          />
        }

        <div class="flex min-h-0 min-w-0 flex-1 flex-col">
          <header class="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
            <div class="min-w-0">
              <h2 class="text-lg font-semibold text-slate-900">{{ title() }}</h2>
              @if (subtitle()) {
                <p class="mt-0.5 text-sm text-slate-500">{{ subtitle() }}</p>
              }
            </div>
            <button
              type="button"
              class="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              (click)="dismiss.emit()"
              aria-label="Đóng"
            >
              <app-icon name="close" [size]="20" />
            </button>
          </header>

          <div class="scroll-thin min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <ng-content />
          </div>

          <footer class="shrink-0 border-t border-slate-100 px-6 py-4">
            <ng-content select="[modalFooter]" />
          </footer>
        </div>
      </div>
    </div>
  `,
})
export class DetailModalComponent {
  readonly title = input('');
  readonly subtitle = input('');
  /** Ảnh cho cột trái (rỗng: không có cột ảnh) */
  readonly photos = input<string[]>([]);
  readonly dismiss = output<void>();

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.dismiss.emit();
  }
}
