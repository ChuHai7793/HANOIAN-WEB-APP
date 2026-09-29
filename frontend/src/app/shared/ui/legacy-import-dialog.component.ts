import { Component, inject, OnInit } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { LegacyImportService } from '../../core/services/legacy-import.service';
import { ModalComponent } from './modal.component';

/** Hỏi người dùng có đưa dữ liệu cũ trong trình duyệt lên tài khoản không, rồi hiện tiến trình. */
@Component({
  selector: 'app-legacy-import-dialog',
  imports: [ModalComponent],
  template: `
    @switch (state().step) {
      @case ('offer') {
        @if (offer(); as p) {
          <app-modal title="Tìm thấy dữ liệu cũ" width="max-w-md" (dismiss)="service.later()">
            <p class="text-sm leading-relaxed text-slate-600">
              Trình duyệt này còn dữ liệu từ phiên bản trước:
              <strong>{{ p.places.length }} quán</strong>,
              <strong>{{ p.girlfriends.length }} người</strong> và
              <strong>{{ p.placeLinks.length }} lần đi cùng</strong>. Tải lên tài khoản để xem được
              ở mọi thiết bị?
            </p>
            <div modalFooter class="contents">
              <button
                type="button"
                class="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
                (click)="service.dismiss()"
              >
                Không nhập
              </button>
              <button
                type="button"
                class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                (click)="service.later()"
              >
                Để sau
              </button>
              <button
                type="button"
                class="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
                (click)="service.start(p)"
              >
                Tải lên
              </button>
            </div>
          </app-modal>
        }
      }
      @case ('running') {
        <app-modal title="Đang tải dữ liệu lên…" width="max-w-md" (dismiss)="noop()">
          <p class="text-sm text-slate-600">
            ⏳ Server đang xử lý (kể cả ảnh), thường chỉ mất vài giây. Đừng đóng trang.
          </p>
          <div modalFooter class="contents"></div>
        </app-modal>
      }
      @case ('done') {
        @if (done(); as s) {
          <app-modal title="Đã tải lên xong" width="max-w-md" (dismiss)="service.close()">
            <p class="text-sm text-slate-600">
              Đã thêm {{ s.places }} quán, {{ s.girlfriends }} người, {{ s.placeLinks }} lần đi cùng
              và {{ s.images }} ảnh.
            </p>
            @if (s.skipped > 0) {
              <p class="mt-3 text-sm text-amber-700">Bỏ qua {{ s.skipped }} mục không hợp lệ:</p>
              <ul class="mt-1 max-h-40 list-disc overflow-y-auto pl-5 text-xs text-slate-500">
                @for (reason of s.skippedReasons; track $index) {
                  <li>{{ reason }}</li>
                }
              </ul>
            }
            <div modalFooter class="contents">
              <button
                type="button"
                class="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
                (click)="service.close()"
              >
                Xong
              </button>
            </div>
          </app-modal>
        }
      }
      @case ('failed') {
        @if (failed(); as f) {
          <app-modal title="Chưa tải lên được" width="max-w-md" (dismiss)="service.later()">
            <p class="text-sm text-slate-600">{{ f.message }}</p>
            <p class="mt-2 text-xs text-slate-500">Dữ liệu cũ vẫn còn nguyên trong trình duyệt.</p>
            <div modalFooter class="contents">
              <button
                type="button"
                class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                (click)="service.later()"
              >
                Để sau
              </button>
              <button
                type="button"
                class="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
                (click)="service.start(f.payload)"
              >
                Thử lại
              </button>
            </div>
          </app-modal>
        }
      }
    }
  `,
})
export class LegacyImportDialogComponent implements OnInit {
  protected readonly service = inject(LegacyImportService);
  private readonly auth = inject(AuthService);
  protected readonly state = this.service.state;

  protected offer() {
    const s = this.state();
    return s.step === 'offer' ? s.payload : null;
  }

  protected done() {
    const s = this.state();
    return s.step === 'done' ? s.stats : null;
  }

  protected failed() {
    const s = this.state();
    return s.step === 'failed' ? s : null;
  }

  /** Đang chạy thì không cho đóng dialog: đóng rồi người dùng không biết kết quả. */
  protected noop(): void {}

  ngOnInit(): void {
    // Guest chỉ xem, không import được (server trả 403): không hỏi
    if (this.auth.canEdit()) this.service.check();
  }
}
