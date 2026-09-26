import { Component, input, output } from '@angular/core';
import { ModalComponent } from './modal.component';

@Component({
  selector: 'app-confirm-dialog',
  imports: [ModalComponent],
  template: `
    <app-modal [title]="title()" width="max-w-md" (dismiss)="cancel.emit()">
      <p class="text-sm leading-relaxed text-slate-600">{{ message() }}</p>

      <div modalFooter class="contents">
        <button
          type="button"
          class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          (click)="cancel.emit()"
        >
          Huỷ
        </button>
        <button
          type="button"
          class="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700"
          (click)="confirm.emit()"
        >
          {{ confirmLabel() }}
        </button>
      </div>
    </app-modal>
  `,
})
export class ConfirmDialogComponent {
  readonly title = input('Xác nhận xoá');
  readonly message = input('Bạn có chắc muốn xoá mục này không?');
  readonly confirmLabel = input('Xoá');
  readonly confirm = output<void>();
  readonly cancel = output<void>();
}
