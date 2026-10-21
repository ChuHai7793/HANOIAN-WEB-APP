import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { errorMessage } from '../../core/api/api';
import { CatalogService } from '../../core/services/catalog.service';
import { SpotService } from '../../core/services/spot.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from './icon.component';
import { ModalComponent } from './modal.component';

interface Slot {
  /** Khoá ổn định cho @for khi đổi thứ tự */
  key: number;
  id: string;
  kicker: string;
  headline: string;
}

/** Một mục nổi bật đang có (id quán / chỗ chơi + chữ) */
export interface FeaturedSlot {
  id: string;
  kicker: string;
  headline: string;
}

export const MAX_FEATURED = 10;

/** Chữ mẫu điền sẵn khi admin chọn mà chưa viết chữ (lần lượt theo vị trí) */
const TEXT = {
  place: {
    title: 'Điểm hẹn nổi bật',
    page: 'Khám phá quán',
    noun: 'quán',
    saved: 'Đã lưu điểm hẹn nổi bật.',
    kicker: 'Dòng nhỏ góc thẻ, không bắt buộc (vd. Một chút bình yên)',
    headline: 'Phụ chú dưới địa chỉ, không bắt buộc (vd. Chậm lại, bên một tách cà phê. Enter để xuống dòng)',
  },
  spot: {
    title: 'Chỗ chơi nổi bật',
    page: 'Tìm chỗ chơi',
    noun: 'chỗ chơi',
    saved: 'Đã lưu chỗ chơi nổi bật.',
    kicker: 'Dòng nhỏ góc thẻ, không bắt buộc (vd. Cùng làm một thứ)',
    headline: 'Phụ chú dưới địa chỉ, không bắt buộc (vd. Nặn đôi cốc cho hai người. Enter để xuống dòng)',
  },
};

/**
 * Admin chọn danh sách nổi bật (tối đa 10) của Khám phá quán (`kind` place) hoặc Tìm chỗ chơi (spot): mỗi dòng
 * một quán / chỗ chơi; dòng nhỏ và câu dẫn không bắt buộc (thẻ lấy tên + sao + địa chỉ làm chính). Thứ tự trong
 * danh sách là thứ tự trên hàng.
 */
@Component({
  selector: 'app-featured-editor',
  imports: [ModalComponent, IconComponent],
  template: `
    <app-modal [title]="text().title" [subtitle]="'Tối đa ' + max + ' ' + text().noun + ', xếp thành hàng ngang ở đầu ' + text().page + '. Thứ tự trong danh sách là thứ tự hiển thị.'" width="max-w-2xl" (dismiss)="closed.emit()">
      <div class="flex flex-col gap-4">
        @for (s of slots(); track s.key; let i = $index, first = $first, last = $last) {
          <fieldset class="rounded-xl border border-slate-200 p-4">
            <div class="mb-3 flex items-center gap-2">
              <span class="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{{ i + 1 }}</span>
              <span class="flex-1 text-sm font-semibold text-slate-700 first-letter:uppercase">{{ text().noun }} nổi bật {{ i + 1 }}</span>
              <button type="button" class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30" [disabled]="first" aria-label="Lên trên" (click)="move(i, -1)">
                <span class="-rotate-90 inline-flex"><app-icon name="arrowRight" [size]="15" /></span>
              </button>
              <button type="button" class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30" [disabled]="last" aria-label="Xuống dưới" (click)="move(i, 1)">
                <span class="rotate-90 inline-flex"><app-icon name="arrowRight" [size]="15" /></span>
              </button>
              <button type="button" class="rounded-md p-1.5 text-rose-500 hover:bg-rose-50" [attr.aria-label]="'Bỏ ' + text().noun + ' này'" (click)="remove(i)">
                <app-icon name="close" [size]="15" />
              </button>
            </div>
            <div class="flex flex-col gap-3">
              <select class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" (change)="choose(i, $any($event.target).value)">
                <option value="" [selected]="!s.id">— Chọn {{ text().noun }} —</option>
                @for (o of options(); track o.id) {
                  <option [value]="o.id" [selected]="o.id === s.id">{{ o.label }}</option>
                }
              </select>
              <input class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" maxlength="60" [placeholder]="text().kicker" [value]="s.kicker" (input)="patch(i, { kicker: $any($event.target).value })" />
              <textarea class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" rows="2" maxlength="120" [placeholder]="text().headline" [value]="s.headline" (input)="patch(i, { headline: $any($event.target).value })"></textarea>
            </div>
          </fieldset>
        } @empty {
          <p class="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">Chưa có {{ text().noun }} nổi bật nào. Khối nổi bật đang ẩn với mọi người.</p>
        }
        @if (slots().length < max) {
          <button type="button" class="flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-brand-200 py-3 text-sm font-semibold text-brand-700 hover:bg-brand-50" (click)="add()">
            <app-icon name="plus" [size]="16" [stroke]="2.4" />Thêm {{ text().noun }} nổi bật ({{ slots().length }}/{{ max }})
          </button>
        }
        @if (error()) {
          <p class="text-sm text-rose-600">{{ error() }}</p>
        }
      </div>
      <div modalFooter class="contents">
        <button type="button" class="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50" (click)="closed.emit()">Huỷ</button>
        <button type="button" class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50" [disabled]="busy()" (click)="save()">Lưu</button>
      </div>
    </app-modal>
  `,
})
export class FeaturedEditorComponent implements OnInit {
  private readonly catalog = inject(CatalogService);
  private readonly spots = inject(SpotService);
  private readonly toast = inject(ToastService);

  readonly kind = input.required<'place' | 'spot'>();
  readonly current = input<FeaturedSlot[]>([]);
  readonly closed = output<void>();
  /** Đã lưu: trang cha tải lại danh sách nổi bật */
  readonly saved = output<void>();

  protected readonly max = MAX_FEATURED;
  protected readonly options = signal<{ id: string; label: string }[]>([]);
  protected readonly slots = signal<Slot[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  private nextKey = 0;

  protected text() {
    return TEXT[this.kind()];
  }

  async ngOnInit(): Promise<void> {
    this.slots.set(this.current().map((f) => ({ key: this.nextKey++, ...f })));
    const items = this.kind() === 'place' ? (await this.catalog.search({ size: 100 })).items : (await this.spots.search({ size: 100 })).items;
    this.options.set(items.map((x) => ({ id: x.id, label: `${x.name} · ${x.districtLabel}` })));
  }

  protected add(): void {
    if (this.slots().length >= this.max) return;
    this.slots.update((list) => [...list, { key: this.nextKey++, id: '', kicker: '', headline: '' }]);
  }

  protected remove(i: number): void {
    this.slots.update((list) => list.filter((_, j) => j !== i));
  }

  protected move(i: number, delta: -1 | 1): void {
    this.slots.update((list) => {
      const next = [...list];
      [next[i], next[i + delta]] = [next[i + delta], next[i]];
      return next;
    });
  }

  protected choose(i: number, id: string): void {
    this.patch(i, { id });
  }

  protected patch(i: number, change: Partial<Slot>): void {
    this.slots.update((list) => list.map((s, j) => (j === i ? { ...s, ...change } : s)));
  }

  protected async save(): Promise<void> {
    const list = this.slots();
    const noun = this.text().noun;
    if (list.some((s) => !s.id)) return this.error.set(`Chọn ${noun} cho mọi dòng, hoặc bỏ dòng chưa chọn.`);
    if (new Set(list.map((s) => s.id)).size !== list.length) return this.error.set(`Mỗi ${noun} chỉ chọn một lần.`);
    this.busy.set(true);
    this.error.set('');
    try {
      const rows = list.map((s) => ({ kicker: s.kicker.trim(), headline: s.headline.trim(), id: s.id }));
      if (this.kind() === 'place') {
        await this.catalog.setFeatured(rows.map(({ id, ...r }) => ({ catalogId: id, ...r })));
      } else {
        await this.spots.setFeatured(rows.map(({ id, ...r }) => ({ spotId: id, ...r })));
      }
      this.toast.success(this.text().saved);
      this.saved.emit();
    } catch (err) {
      this.error.set(err instanceof HttpErrorResponse ? errorMessage(err) : 'Không lưu được.');
    } finally {
      this.busy.set(false);
    }
  }
}
