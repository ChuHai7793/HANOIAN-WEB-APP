import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-modal',
  template: `
    <div class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div
        class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
        (click)="dismiss.emit()"
      ></div>

      <div
        class="relative z-10 w-full rounded-2xl bg-white shadow-2xl"
        [class]="width()"
      >
        <header class="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">{{ title() }}</h2>
            @if (subtitle()) {
              <p class="mt-0.5 text-sm text-slate-500">{{ subtitle() }}</p>
            }
          </div>
          <button
            type="button"
            class="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            (click)="dismiss.emit()"
            aria-label="Đóng"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div class="scroll-thin max-h-[70vh] overflow-y-auto px-6 py-5">
          <ng-content />
        </div>

        <footer class="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
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
}
