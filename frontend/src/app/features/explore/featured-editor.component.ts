import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { errorMessage } from '../../core/api/api';
import { CatalogItem, FeaturedItem } from '../../core/models/catalog.model';
import { CatalogService } from '../../core/services/catalog.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { ModalComponent } from '../../shared/ui/modal.component';

interface Slot {
  /** Khoá ổn định cho @for khi đổi thứ tự */
  key: number;
  catalogId: string;
  kicker: string;
  headline: string;
}

export const MAX_FEATURED = 6;

/** Chữ mẫu điền sẵn khi admin chọn quán mà chưa viết chữ (lần lượt theo vị trí) */
const SAMPLES: { kicker: string; headline: string }[] = [
  { kicker: 'Điểm hẹn nổi bật', headline: 'Hẹn nhau ở\nphía hoàng hôn.' },
  { kicker: 'Một chút bình yên', headline: 'Chậm lại, bên\nmột tách cà phê.' },
  { kicker: 'Góc nhỏ riêng tư', headline: 'Một góc nhỏ.\nHai người thôi.' },
  { kicker: 'Hẹn tối nay', headline: 'Một bữa tối,\nhai câu chuyện.' },
  { kicker: 'Dạo phố cùng nhau', headline: 'Đi chậm thôi,\nHà Nội còn dài.' },
  { kicker: 'Cho ngày mưa', headline: 'Mưa ngoài kia,\nấm áp bên trong.' },
];

/**
 * Admin chọn danh sách điểm hẹn nổi bật (tối đa 6): mỗi dòng một quán + dòng nhỏ + câu dẫn (xuống dòng bằng
 * Enter). Thứ tự trong danh sách là thứ tự trên hàng trượt.
 */
@Component({
  selector: 'app-featured-editor',
  imports: [ModalComponent, IconComponent],
  template: `
    <app-modal title="Điểm hẹn nổi bật" [subtitle]="'Tối đa ' + max + ' quán, xếp thành hàng ngang ở đầu Khám phá quán. Thứ tự trong danh sách là thứ tự hiển thị.'" width="max-w-2xl" (dismiss)="closed.emit()">
      <div class="flex flex-col gap-4">
        @for (s of slots(); track s.key; let i = $index, first = $first, last = $last) {
          <fieldset class="rounded-xl border border-slate-200 p-4">
            <div class="mb-3 flex items-center gap-2">
              <span class="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{{ i + 1 }}</span>
              <span class="flex-1 text-sm font-semibold text-slate-700">Quán nổi bật {{ i + 1 }}</span>
              <button type="button" class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30" [disabled]="first" aria-label="Lên trên" (click)="move(i, -1)">
                <span class="-rotate-90 inline-flex"><app-icon name="arrowRight" [size]="15" /></span>
              </button>
              <button type="button" class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30" [disabled]="last" aria-label="Xuống dưới" (click)="move(i, 1)">
                <span class="rotate-90 inline-flex"><app-icon name="arrowRight" [size]="15" /></span>
              </button>
              <button type="button" class="rounded-md p-1.5 text-rose-500 hover:bg-rose-50" aria-label="Bỏ quán này" (click)="remove(i)">
                <app-icon name="close" [size]="15" />
              </button>
            </div>
            <div class="flex flex-col gap-3">
              <select class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" (change)="choose(i, $any($event.target).value)">
                <option value="" [selected]="!s.catalogId">— Chọn quán —</option>
                @for (p of places(); track p.id) {
                  <option [value]="p.id" [selected]="p.id === s.catalogId">{{ p.name }} · {{ p.districtLabel }}</option>
                }
              </select>
              <input class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" maxlength="60" placeholder="Dòng nhỏ, vd. Một chút bình yên" [value]="s.kicker" (input)="patch(i, { kicker: $any($event.target).value })" />
              <textarea class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" rows="2" maxlength="120" placeholder="Câu dẫn, vd. Chậm lại, bên một tách cà phê. (Enter để xuống dòng)" [value]="s.headline" (input)="patch(i, { headline: $any($event.target).value })"></textarea>
            </div>
          </fieldset>
        } @empty {
          <p class="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">Chưa có quán nổi bật nào. Khối nổi bật đang ẩn với mọi người.</p>
        }
        @if (slots().length < max) {
          <button type="button" class="flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-brand-200 py-3 text-sm font-semibold text-brand-700 hover:bg-brand-50" (click)="add()">
            <app-icon name="plus" [size]="16" [stroke]="2.4" />Thêm quán nổi bật ({{ slots().length }}/{{ max }})
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
  private readonly toast = inject(ToastService);

  readonly current = input<FeaturedItem[]>([]);
  readonly closed = output<void>();
  readonly saved = output<FeaturedItem[]>();

  protected readonly max = MAX_FEATURED;
  protected readonly places = signal<CatalogItem[]>([]);
  protected readonly slots = signal<Slot[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  private nextKey = 0;

  async ngOnInit(): Promise<void> {
    this.slots.set(this.current().map((f) => ({ key: this.nextKey++, catalogId: f.place.id, kicker: f.kicker, headline: f.headline })));
    const page = await this.catalog.search({ size: 100 });
    this.places.set(page.items);
  }

  protected add(): void {
    if (this.slots().length >= this.max) return;
    this.slots.update((list) => [...list, { key: this.nextKey++, catalogId: '', kicker: '', headline: '' }]);
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

  protected choose(i: number, catalogId: string): void {
    const s = this.slots()[i];
    // Chọn quán lần đầu: điền sẵn chữ mẫu để sửa lại
    const sample = SAMPLES[i % SAMPLES.length];
    const fill = catalogId && !s.headline ? { kicker: s.kicker || sample.kicker, headline: sample.headline } : {};
    this.patch(i, { catalogId, ...fill });
  }

  protected patch(i: number, change: Partial<Slot>): void {
    this.slots.update((list) => list.map((s, j) => (j === i ? { ...s, ...change } : s)));
  }

  protected async save(): Promise<void> {
    const list = this.slots();
    if (list.some((s) => !s.catalogId)) return this.error.set('Chọn quán cho mọi dòng, hoặc bỏ dòng chưa chọn.');
    if (list.some((s) => !s.headline.trim())) return this.error.set('Viết câu dẫn cho mọi quán.');
    if (new Set(list.map((s) => s.catalogId)).size !== list.length) return this.error.set('Mỗi quán chỉ chọn một lần.');
    this.busy.set(true);
    this.error.set('');
    try {
      const result = await this.catalog.setFeatured(list.map((s) => ({ catalogId: s.catalogId, kicker: s.kicker.trim(), headline: s.headline.trim() })));
      this.toast.success('Đã lưu điểm hẹn nổi bật.');
      this.saved.emit(result);
    } catch (err) {
      this.error.set(err instanceof HttpErrorResponse ? errorMessage(err) : 'Không lưu được.');
    } finally {
      this.busy.set(false);
    }
  }
}
