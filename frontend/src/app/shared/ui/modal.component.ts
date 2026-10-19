import { Component, HostListener, input, output } from '@angular/core';
import { useOverlay } from './overlay';

/**
 * Popup chung (form, hộp xác nhận, chọn plan…). Màn rộng: hộp ở giữa. Điện thoại: bảng trượt từ dưới lên, rộng
 * hết màn hình, cao tối đa gần hết màn hình; phần giữa tự cuộn, hàng nút luôn thấy và chừa vùng thanh home.
 * Khoá cuộn trang phía sau; nút Back của điện thoại và Esc đóng popup.
 */
@Component({
  selector: 'app-modal',
  template: `
    <div class="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" (click)="dismiss.emit()"></div>

      <div
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title()"
        class="relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:max-h-[92dvh] sm:rounded-2xl"
        [class]="width()"
      >
        <header class="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 py-3 pl-5 pr-2 sm:px-6 sm:py-4 sm:pr-3">
          <div class="min-w-0 pt-1.5 sm:pt-0">
            <h2 class="text-lg font-semibold text-slate-900">{{ title() }}</h2>
            @if (subtitle()) {
              <p class="mt-0.5 text-sm text-slate-500">{{ subtitle() }}</p>
            }
          </div>
          <button
            type="button"
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            (click)="dismiss.emit()"
            aria-label="Đóng"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div class="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          <ng-content />
        </div>

        <footer class="flex shrink-0 flex-wrap justify-end gap-3 border-t border-slate-100 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
          <ng-content select="[modalFooter]" />
        </footer>
      </div>
    </div>
  `,
})
export class ModalComponent {
  readonly title = input('');
  readonly subtitle = input('');
  readonly width = input('max-w-2xl');
  readonly dismiss = output<void>();

  constructor() {
    useOverlay(() => this.dismiss.emit());
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.dismiss.emit();
  }
}
