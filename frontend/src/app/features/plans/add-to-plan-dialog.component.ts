import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PlanSummary, StopKind } from '../../core/models/plan.model';
import { PlanService } from '../../core/services/plan.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { ModalComponent } from '../../shared/ui/modal.component';

/** "Vào plan" từ thẻ quán / chỗ chơi: chọn một plan chưa đi, hoặc tạo plan mới với điểm này. */
@Component({
  selector: 'app-add-to-plan-dialog',
  imports: [IconComponent, ModalComponent],
  template: `
    <app-modal title="Thêm vào plan" [subtitle]="name()" width="max-w-md" (dismiss)="closed.emit()">
      <button
        type="button"
        class="flex w-full items-center gap-3 rounded-xl border border-dashed border-brand-300 px-3 py-3 text-left text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50"
        [disabled]="busy()"
        (click)="createWith()"
      >
        <app-icon name="plus" [size]="18" />Plan mới với điểm này
      </button>
      @if (plans().length) {
        <p class="mb-1 mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">Plan đang có</p>
        <ul class="divide-y divide-slate-100">
          @for (p of plans(); track p.id) {
            <li class="flex items-center gap-3 py-2.5">
              <span class="text-brand-500"><app-icon name="route" [size]="18" /></span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold text-slate-900">{{ p.title }}</p>
                <p class="text-xs text-slate-500">{{ p.stopCount }} điểm{{ p.districtLabel ? ' · ' + p.districtLabel : '' }}</p>
              </div>
              <button type="button" class="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50" [disabled]="busy() || p.stopCount >= 12" (click)="addTo(p)">Thêm</button>
            </li>
          }
        </ul>
      }
      <div modalFooter>
        <button type="button" class="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600" (click)="closed.emit()">Đóng</button>
      </div>
    </app-modal>
  `,
})
export class AddToPlanDialogComponent implements OnInit {
  private readonly api = inject(PlanService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly kind = input.required<StopKind>();
  readonly refId = input.required<string>();
  readonly name = input.required<string>();
  /** Khu vực của điểm, làm khu vực của plan mới */
  readonly district = input<string | null>(null);
  readonly closed = output<void>();

  protected readonly plans = signal<PlanSummary[]>([]);
  protected readonly busy = signal(false);

  async ngOnInit(): Promise<void> {
    this.plans.set((await this.api.list()).filter((p) => p.status !== 'done'));
  }

  protected async addTo(p: PlanSummary): Promise<void> {
    await this.guard(async () => {
      await this.api.addStop(p.id, this.kind(), this.refId());
      this.toast.success(`Đã thêm "${this.name()}" vào plan "${p.title}".`);
    });
  }

  protected async createWith(): Promise<void> {
    await this.guard(async () => {
      const plan = await this.api.create({
        title: `Hẹn ở ${this.name()}`,
        date: null,
        startTime: '18:00',
        district: this.district(),
        note: '',
        vibe: null,
        budget: null,
        rainy: false,
      });
      await this.api.addStop(plan.id, this.kind(), this.refId());
      await this.router.navigate(['/plans', plan.id]);
    });
  }

  private async guard(work: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await work();
      this.closed.emit();
    } finally {
      this.busy.set(false);
    }
  }
}
