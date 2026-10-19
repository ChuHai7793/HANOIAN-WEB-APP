import { Component, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from './icon.component';

/** Thông báo nổi: điện thoại ở giữa dưới, phía trên thanh tab; máy tính ở góc dưới phải. */
@Component({
  selector: 'app-toast-host',
  imports: [IconComponent],
  template: `
    <div
      class="pointer-events-none fixed inset-x-0 bottom-[calc(var(--app-tabbar-h)+0.75rem)] z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-[calc(var(--app-tabbar-h)+1.5rem)] sm:items-end sm:px-6 lg:bottom-6"
      aria-live="polite"
    >
      @for (t of toast.toasts(); track t.id) {
        <div
          class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border py-3 pl-4 pr-2 text-sm shadow-lg"
          [class]="classes[t.kind]"
          role="status"
        >
          <span class="mt-0.5"><app-icon [name]="icons[t.kind]" [size]="18" /></span>
          <p class="flex-1 py-0.5">{{ t.message }}</p>
          <button
            type="button"
            class="-my-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg opacity-60 transition hover:opacity-100"
            (click)="toast.dismiss(t.id)"
            aria-label="Đóng thông báo"
          ><app-icon name="close" [size]="16" /></button>
        </div>
      }
    </div>
  `,
})
export class ToastHostComponent {
  protected readonly toast = inject(ToastService);
  protected readonly icons = { error: 'alert', success: 'checkCircle', info: 'info' } as const;
  protected readonly classes = {
    error: 'border-rose-200 bg-rose-50 text-rose-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    info: 'border-slate-200 bg-white text-slate-700',
  };
}
