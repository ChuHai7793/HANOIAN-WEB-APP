import { Injectable, signal } from '@angular/core';

/** reload: giữ bản trên server; overwrite: ghi đè bằng thay đổi của mình. */
export type ConflictChoice = 'reload' | 'overwrite';

export interface ConflictPrompt {
  /** Tên bản ghi bị xung đột (nếu có), để người dùng biết đang nói về mục nào */
  name?: string;
}

/**
 * Hỏi người dùng khi PATCH gặp VERSION_CONFLICT. ConflictDialogComponent (gắn ở App) hiển thị
 * `pending` và gọi `choose()`; nơi hỏi chỉ việc `await ask()`.
 */
@Injectable({ providedIn: 'root' })
export class ConflictService {
  private readonly state = signal<ConflictPrompt | null>(null);
  readonly pending = this.state.asReadonly();
  private resolve?: (choice: ConflictChoice) => void;

  ask(prompt: ConflictPrompt = {}): Promise<ConflictChoice> {
    // Đang có dialog khác thì câu hỏi cũ chọn phương án an toàn
    this.resolve?.('reload');
    this.state.set(prompt);
    return new Promise((resolve) => (this.resolve = resolve));
  }

  choose(choice: ConflictChoice): void {
    const resolve = this.resolve;
    this.resolve = undefined;
    this.state.set(null);
    resolve?.(choice);
  }
}
