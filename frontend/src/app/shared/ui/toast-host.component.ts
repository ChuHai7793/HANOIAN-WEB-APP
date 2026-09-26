import { Component, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast-host',
  template: `
    <div
      class="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:px-6"
      aria-live="polite"
    >
      @for (t of toast.toasts(); track t.id) {
        <div
          class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg"
          [class]="classes[t.kind]"
          role="status"
        >
          <span>{{ icons[t.kind] }}</span>
          <p class="flex-1">{{ t.message }}</p>
          <button
            type="button"
            class="opacity-60 transition hover:opacity-100"
            (click)="toast.dismiss(t.id)"
            aria-label="Đóng thông báo"
          >
            ✕
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastHostComponent {
  protected readonly toast = inject(ToastService);
  protected readonly icons = { error: '⚠️', success: '✅', info: 'ℹ️' };
  protected readonly classes = {
    error: 'border-rose-200 bg-rose-50 text-rose-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    info: 'border-slate-200 bg-white text-slate-700',
  };
}
