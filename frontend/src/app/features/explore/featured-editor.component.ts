import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { errorMessage } from '../../core/api/api';
import { CatalogItem, FeaturedItem } from '../../core/models/catalog.model';
import { CatalogService } from '../../core/services/catalog.service';
import { ToastService } from '../../core/services/toast.service';
import { ModalComponent } from '../../shared/ui/modal.component';

interface Slot {
  catalogId: string;
  kicker: string;
  headline: string;
}

/** Gợi ý điền sẵn cho từng vị trí khi admin chọn quán mà chưa viết chữ */
const SAMPLE: Slot[] = [
  { catalogId: '', kicker: 'Điểm hẹn nổi bật', headline: 'Hẹn nhau ở\nphía hoàng hôn.' },
  { catalogId: '', kicker: '02 · Một chút bình yên', headline: 'Chậm lại, bên\nmột tách cà phê.' },
  { catalogId: '', kicker: '03 · Góc nhỏ riêng tư', headline: 'Một góc nhỏ.\nHai người thôi.' },
];

/** Admin chọn tối đa 3 điểm hẹn nổi bật: quán, dòng nhỏ, câu dẫn (xuống dòng bằng Enter). Bỏ trống quán = bỏ vị trí. */
@Component({
  selector: 'app-featured-editor',
  imports: [ModalComponent],
  template: `
    <app-modal title="Điểm hẹn nổi bật" subtitle="Tối đa 3 quán ở đầu trang Khám phá quán. Vị trí 1 là thẻ lớn." width="max-w-2xl" (dismiss)="closed.emit()">
      <div class="flex flex-col gap-5">
        @for (s of slots(); track $index; let i = $index) {
          <fieldset class="rounded-xl border border-slate-200 p-4">
            <legend class="px-1 text-sm font-semibold text-slate-700">Vị trí {{ i + 1 }}{{ i === 0 ? ' (thẻ lớn)' : '' }}</legend>
            <div class="flex flex-col gap-3">
              <select class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" [value]="s.catalogId" (change)="choose(i, $any($event.target).value)">
                <option value="">— Không hiện —</option>
                @for (p of places(); track p.id) {
                  <option [value]="p.id" [selected]="p.id === s.catalogId">{{ p.name }} · {{ p.districtLabel }}</option>
                }
              </select>
              @if (s.catalogId) {
                <input class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" maxlength="60" placeholder="Dòng nhỏ, vd. Một chút bình yên" [value]="s.kicker" (input)="patch(i, { kicker: $any($event.target).value })" />
                <textarea class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" rows="2" maxlength="120" placeholder="Câu dẫn, vd. Chậm lại, bên một tách cà phê." [value]="s.headline" (input)="patch(i, { headline: $any($event.target).value })"></textarea>
              }
            </div>
          </fieldset>
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

  protected readonly places = signal<CatalogItem[]>([]);
  protected readonly slots = signal<Slot[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  async ngOnInit(): Promise<void> {
    const byPos = new Map(this.current().map((f) => [f.position, f]));
    this.slots.set(
      [1, 2, 3].map((pos) => {
        const f = byPos.get(pos);
        return f ? { catalogId: f.place.id, kicker: f.kicker, headline: f.headline } : { catalogId: '', kicker: '', headline: '' };
      }),
    );
    const page = await this.catalog.search({ size: 100 });
    this.places.set(page.items);
  }

  protected choose(i: number, catalogId: string): void {
    const s = this.slots()[i];
    // Chọn quán lần đầu: điền sẵn chữ mẫu cho vị trí đó để sửa lại
    const fill = catalogId && !s.headline ? { kicker: SAMPLE[i].kicker, headline: SAMPLE[i].headline } : {};
    this.patch(i, { catalogId, ...fill });
  }

  protected patch(i: number, change: Partial<Slot>): void {
    this.slots.update((list) => list.map((s, j) => (j === i ? { ...s, ...change } : s)));
  }

  protected async save(): Promise<void> {
    const chosen = this.slots().filter((s) => s.catalogId);
    if (chosen.some((s) => !s.headline.trim())) return this.error.set('Viết câu dẫn cho mọi quán đã chọn.');
    if (new Set(chosen.map((s) => s.catalogId)).size !== chosen.length) return this.error.set('Mỗi quán chỉ chọn một lần.');
    this.busy.set(true);
    this.error.set('');
    try {
      const result = await this.catalog.setFeatured(chosen.map((s) => ({ catalogId: s.catalogId, kicker: s.kicker.trim(), headline: s.headline.trim() })));
      this.toast.success('Đã lưu điểm hẹn nổi bật.');
      this.saved.emit(result);
    } catch (err) {
      this.error.set(err instanceof HttpErrorResponse ? errorMessage(err) : 'Không lưu được.');
    } finally {
      this.busy.set(false);
    }
  }
}
