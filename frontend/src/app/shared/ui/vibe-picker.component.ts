import { Component, computed, input, model } from '@angular/core';
import { sortVibes, Vibe, VibeChoice, VIBES, VibeSource } from '../../core/models/vibe.model';

/**
 * Admin chọn nhãn kiểu hẹn trong form thêm / sửa quán, chỗ chơi. Mặc định "tự gán theo loại" (nhãn đi theo
 * loại đang chọn trong form); bấm một nhãn là chọn tay; "↺ Để hệ thống tự gán" để quay lại tự gán.
 */
@Component({
  selector: 'app-vibe-picker',
  template: `
    <div>
      <p class="mb-1.5 text-sm font-medium text-slate-700">Kiểu hẹn phù hợp</p>
      <div class="flex flex-wrap gap-2">
        @for (v of vibes; track v.value) {
          <button
            type="button"
            class="rounded-full border px-3 py-1 text-xs font-medium transition"
            [class]="shown().includes(v.value) ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'"
            [attr.aria-pressed]="shown().includes(v.value)"
            (click)="toggle(v.value)"
          >
            {{ v.icon }} {{ v.label }}
          </button>
        }
      </div>
      <p class="mt-1.5 text-xs text-slate-500">
        @switch (state()) {
          @case ('auto') {
            Tự gán theo loại. Bấm để chọn tay.
          }
          @case ('claude') {
            🤖 Claude gán theo mô tả.
            <button type="button" class="ml-1 font-medium text-brand-700 hover:underline" (click)="reset()">↺ Để hệ thống tự gán</button>
          }
          @default {
            ✍️ Chọn tay, không bị tự gán đè.
            <button type="button" class="ml-1 font-medium text-brand-700 hover:underline" (click)="reset()">↺ Để hệ thống tự gán</button>
          }
        }
      </p>
    </div>
  `,
})
export class VibePickerComponent {
  /** Lựa chọn hiện tại (form đọc lại khi lưu) */
  readonly choice = model.required<VibeChoice>();
  /** Nhãn mặc định theo loại đang chọn trong form */
  readonly defaults = input.required<Vibe[]>();
  /** Nguồn nhãn đang lưu trên server (null khi thêm mới) */
  readonly source = input<VibeSource | null>(null);
  /** Nhãn đang lưu trên server (để biết admin có đổi gì không) */
  readonly saved = input<Vibe[] | null>(null);

  protected readonly vibes = VIBES;

  /** Đang tự gán thì hiện nhãn theo loại, đi theo khi đổi loại */
  protected readonly shown = computed(() => (this.choice().auto ? this.defaults() : this.choice().vibes));

  protected readonly state = computed<'auto' | 'claude' | 'admin'>(() => {
    if (this.choice().auto) return 'auto';
    const saved = this.saved();
    const unchanged = saved !== null && sortVibes(saved).join() === sortVibes(this.choice().vibes).join();
    return this.source() === 'claude' && unchanged ? 'claude' : 'admin';
  });

  protected toggle(v: Vibe): void {
    const current = this.shown();
    const next = current.includes(v) ? current.filter((x) => x !== v) : [...current, v];
    this.choice.set({ vibes: sortVibes(next), auto: false });
  }

  protected reset(): void {
    this.choice.set({ vibes: this.defaults(), auto: true });
  }
}
