import { Injectable, signal } from '@angular/core';

export type ToastKind = 'error' | 'success' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

/** Thông báo nổi góc màn hình, tự ẩn sau vài giây. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly state = signal<Toast[]>([]);
  readonly toasts = this.state.asReadonly();

  show(message: string, kind: ToastKind = 'info', durationMs = 5000): void {
    // Cùng một câu đang hiện thì không chồng thêm (nhiều request lỗi cùng lúc)
    if (this.state().some((t) => t.message === message)) return;
    const toast: Toast = { id: this.nextId++, kind, message };
    this.state.update((list) => [...list, toast]);
    setTimeout(() => this.dismiss(toast.id), durationMs);
  }

  error(message: string): void {
    this.show(message, 'error', 7000);
  }

  success(message: string): void {
    this.show(message, 'success', 3000);
  }

  dismiss(id: number): void {
    this.state.update((list) => list.filter((t) => t.id !== id));
  }
}
