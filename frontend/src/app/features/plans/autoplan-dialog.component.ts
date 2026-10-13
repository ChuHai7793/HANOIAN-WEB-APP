import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { DistrictOption } from '../../core/models/catalog.model';
import { AutoplanRequest, PLAN_BUDGETS, PLAN_SLOTS, PlanSlot } from '../../core/models/plan.model';
import { Vibe, VIBES } from '../../core/models/vibe.model';
import { CatalogService } from '../../core/services/catalog.service';
import { DateVibeService } from '../../core/services/date-vibe.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { ModalComponent } from '../../shared/ui/modal.component';
import { AutoplanFlowService } from './autoplan-flow.service';

const INPUT = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500';

/**
 * Hộp Autoplan (trang Plan, Khám phá quán, trang xem thử): chọn khu vực + tuỳ chọn rồi dựng plan. Kiểu hẹn
 * mặc định theo kết quả quiz "Gu hẹn hò". Đã đăng nhập: tạo plan; khách: dựng thử (AutoplanFlowService).
 */
@Component({
  selector: 'app-autoplan-dialog',
  imports: [IconComponent, ModalComponent],
  template: `
    <app-modal title="Autoplan" subtitle="Chọn khu vực, app dựng sẵn lịch trình" width="max-w-md" (dismiss)="closed.emit()">
      <div class="space-y-4">
        <label class="block text-sm font-medium text-slate-700">
          Khu vực <span class="text-rose-500">*</span>
          <select class="mt-1.5 {{ input }}" [value]="district()" (change)="district.set($any($event.target).value)">
            <option value="">Chọn quận…</option>
            @for (d of districts(); track d.code) {
              <option [value]="d.code">{{ d.label }}</option>
            }
          </select>
        </label>
        <div>
          <p class="mb-1.5 text-sm font-medium text-slate-700">Buổi</p>
          <div class="grid grid-cols-3 gap-2">
            @for (s of slots; track s.value) {
              <button type="button" class="rounded-lg border px-2 py-2 text-left text-sm transition" [class]="slot() === s.value ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'" (click)="slot.set(s.value)">
                <span class="block font-semibold">{{ s.label }}</span><span class="text-xs text-slate-500">{{ s.hint }}</span>
              </button>
            }
          </div>
        </div>
        <div>
          <p class="mb-1.5 text-sm font-medium text-slate-700">Kiểu hẹn</p>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="rounded-full border px-3 py-1 text-xs font-medium" [class]="vibe() === null ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500'" (click)="vibe.set(null)">Gì cũng được</button>
            @for (v of vibes; track v.value) {
              <button type="button" class="flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium" [class]="vibe() === v.value ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500'" (click)="vibe.set(v.value)">
                <app-icon [name]="v.icon" [size]="13" />{{ v.label }}
              </button>
            }
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <label class="block text-sm font-medium text-slate-700">
            Ngày
            <input type="date" class="mt-1.5 {{ input }}" [value]="date()" (input)="date.set($any($event.target).value)" />
          </label>
          <label class="block text-sm font-medium text-slate-700">
            Ngân sách
            <select class="mt-1.5 {{ input }}" [value]="budgetIndex()" (change)="budgetIndex.set(+$any($event.target).value)">
              @for (b of budgets; track $index) {
                <option [value]="$index">{{ b.label }}</option>
              }
            </select>
          </label>
        </div>
        <label class="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" class="h-4 w-4 accent-brand-600" [checked]="rainy()" (change)="rainy.set($any($event.target).checked)" />
          Trời mưa: chỉ chọn chỗ chơi trong nhà
        </label>
      </div>
      <div modalFooter class="flex gap-2">
        <button type="button" class="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600" (click)="closed.emit()">Huỷ</button>
        <button type="button" class="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50" [disabled]="!district() || busy()" (click)="submit()">
          <app-icon name="shuffle" [size]="16" />Dựng plan
        </button>
      </div>
    </app-modal>
  `,
})
export class AutoplanDialogComponent implements OnInit {
  private readonly catalog = inject(CatalogService);
  private readonly flow = inject(AutoplanFlowService);

  /** Lần dựng trước (trang xem thử): điền sẵn */
  readonly initial = input<AutoplanRequest | null>(null);
  readonly closed = output<void>();

  protected readonly input = INPUT;
  protected readonly slots = PLAN_SLOTS;
  protected readonly budgets = PLAN_BUDGETS;
  protected readonly vibes = VIBES;

  protected readonly districts = signal<DistrictOption[]>([]);
  protected readonly district = signal('');
  protected readonly date = signal('');
  protected readonly slot = signal<PlanSlot>('evening');
  protected readonly vibe = signal<Vibe | null>(inject(DateVibeService).vibe());
  protected readonly budgetIndex = signal(0);
  protected readonly rainy = signal(false);
  protected readonly busy = signal(false);

  async ngOnInit(): Promise<void> {
    const r = this.initial();
    if (r) {
      this.district.set(r.district);
      this.date.set(r.date ?? '');
      this.slot.set(r.slot);
      this.vibe.set(r.vibe);
      this.budgetIndex.set(Math.max(0, this.budgets.findIndex((b) => b.value === r.budget)));
      this.rainy.set(r.rainy);
    }
    this.districts.set(await this.catalog.districts());
  }

  protected async submit(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.flow.run({
        district: this.district(),
        date: this.date() || null,
        slot: this.slot(),
        vibe: this.vibe(),
        budget: this.budgets[this.budgetIndex()].value,
        rainy: this.rainy(),
      });
      this.closed.emit();
    } finally {
      this.busy.set(false);
    }
  }
}
