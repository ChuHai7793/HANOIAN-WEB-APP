import { Component, input, output, signal } from '@angular/core';
import { REPORT_REASONS, ReportReason } from '../../core/models/dating.model';
import { IconComponent } from '../../shared/ui/icon.component';

export interface ReportInput {
  reason: ReportReason;
  note: string;
  block: boolean;
}

/** Báo cáo một người trong "Tìm đối tượng": lý do, ghi chú, có chặn luôn không. Gửi về admin. */
@Component({
  selector: 'app-report-dialog',
  imports: [IconComponent],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" (click)="cancel.emit()">
      <div class="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" (click)="$event.stopPropagation()">
        <h2 class="flex items-center gap-2 text-lg font-bold text-slate-900"><span class="text-rose-600"><app-icon name="flag" [size]="20" /></span>Báo cáo {{ name() }}</h2>
        <p class="mt-1 text-xs text-slate-500">Báo cáo được gửi tới quản trị viên. Người kia không biết ai báo cáo.</p>
        <label class="mb-1 mt-4 block text-sm font-medium text-slate-700">Lý do</label>
        <select
          class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          [value]="reason()"
          (change)="reason.set($any($event.target).value)"
        >
          @for (r of reasons; track r.value) {
            <option [value]="r.value">{{ r.label }}</option>
          }
        </select>
        <label class="mb-1 mt-3 block text-sm font-medium text-slate-700">Chi tiết (không bắt buộc)</label>
        <textarea
          rows="3"
          maxlength="1000"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          [value]="note()"
          (input)="note.set($any($event.target).value)"
        ></textarea>
        <label class="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" class="h-4 w-4 accent-brand-600" [checked]="block()" (change)="block.set($any($event.target).checked)" />
          Chặn người này luôn
        </label>
        <div class="mt-5 flex justify-end gap-2">
          <button type="button" class="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600" (click)="cancel.emit()">Huỷ</button>
          <button
            type="button"
            class="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
            (click)="send.emit({ reason: reason(), note: note().trim(), block: block() })"
          >
            Gửi báo cáo
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ReportDialogComponent {
  readonly name = input.required<string>();
  readonly send = output<ReportInput>();
  readonly cancel = output<void>();

  protected readonly reasons = REPORT_REASONS;
  protected readonly reason = signal<ReportReason>('fake_profile');
  protected readonly note = signal('');
  protected readonly block = signal(true);
}
