import { Component, HostListener, input, output } from '@angular/core';
import { IconComponent } from './icon.component';
import { PhotoCarouselComponent } from './photo-carousel.component';
import { useOverlay } from './overlay';

/**
 * Popup chi tiết quán / chỗ chơi, ở giữa màn hình. Màn rộng: cột trái chỉ có ảnh (hiện trọn, nền là chính ảnh làm
 * mờ, mũi tên mờ khi có nhiều ảnh), cột phải: tiêu đề + nội dung tự cuộn + hàng nút ({@code [modalFooter]}) ở dưới.
 * Điện thoại: bảng trượt từ dưới lên, ảnh ở trên, thông tin ở dưới, hàng nút chừa vùng thanh home. Không có ảnh:
 * chỉ cột thông tin (popup hẹp lại). {@code [modalHeaderLink]}: link nhỏ nằm cuối dòng phụ dưới tiêu đề.
 * Khoá cuộn trang phía sau; nút Back của điện thoại và Esc đóng popup.
 */
@Component({
  selector: 'app-detail-modal',
  imports: [IconComponent, PhotoCarouselComponent],
  template: `
    <div class="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" (click)="dismiss.emit()"></div>

      <div
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title()"
        class="relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[92dvh] sm:rounded-2xl"
        [class]="photos().length ? 'max-w-5xl md:h-[min(86dvh,720px)] md:flex-row' : 'max-w-lg'"
      >
        @if (photos().length) {
          <app-photo-carousel
            class="h-52 w-full shrink-0 bg-slate-900 sm:h-72 md:h-full md:w-[52%]"
            [photos]="photos()"
            [alt]="title()"
            [lazy]="false"
            [contain]="true"
            [backdrop]="true"
          />
        }

        <div class="flex min-h-0 min-w-0 flex-1 flex-col">
          <header class="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 py-3 pl-5 pr-2 sm:px-6 sm:py-4 sm:pr-3">
            <div class="min-w-0 pt-1.5 sm:pt-0">
              <h2 class="text-lg font-semibold text-slate-900">{{ title() }}</h2>
              <p class="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-slate-500">
                {{ subtitle() }}
                <ng-content select="[modalHeaderLink]" />
              </p>
            </div>
            <button
              type="button"
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              (click)="dismiss.emit()"
              aria-label="Đóng"
            >
              <app-icon name="close" [size]="20" />
            </button>
          </header>

          <div class="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
            <ng-content />
          </div>

          <footer class="shrink-0 border-t border-slate-100 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
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

  constructor() {
    useOverlay(() => this.dismiss.emit());
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.dismiss.emit();
  }
}
