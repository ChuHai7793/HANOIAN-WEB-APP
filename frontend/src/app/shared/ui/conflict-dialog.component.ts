import { Component, inject } from '@angular/core';
import { ConflictService } from '../../core/services/conflict.service';
import { ModalComponent } from './modal.component';

/** Dialog xung đột version. Đóng dialog (✕, bấm nền) = tải bản mới, không mất dữ liệu của máy kia. */
@Component({
  selector: 'app-conflict-dialog',
  imports: [ModalComponent],
  template: `
    @if (conflicts.pending(); as prompt) {
      <app-modal
        title="Dữ liệu đã thay đổi"
        width="max-w-md"
        (dismiss)="conflicts.choose('reload')"
      >
        <p class="text-sm leading-relaxed text-slate-600">
          @if (prompt.name) {
            <strong class="text-slate-900">{{ prompt.name }}</strong> vừa
          } @else {
            Mục này vừa
          }
          được sửa ở thiết bị hoặc tab khác trong lúc bạn đang chỉnh.
        </p>
        <ul class="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li><strong>Tải bản mới</strong>: bỏ thay đổi của bạn, giữ bản trên server.</li>
          <li><strong>Ghi đè</strong>: lưu thay đổi của bạn đè lên bản kia.</li>
        </ul>

        <div modalFooter class="contents">
          <button
            type="button"
            class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            (click)="conflicts.choose('overwrite')"
          >
            Ghi đè
          </button>
          <button
            type="button"
            class="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700"
            (click)="conflicts.choose('reload')"
          >
            Tải bản mới
          </button>
        </div>
      </app-modal>
    }
  `,
})
export class ConflictDialogComponent {
  protected readonly conflicts = inject(ConflictService);
}
