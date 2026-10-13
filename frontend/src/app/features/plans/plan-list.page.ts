import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DistrictOption } from '../../core/models/catalog.model';
import {
  PLAN_BUDGETS,
  PLAN_SLOTS,
  planStatusMeta,
  PlanSlot,
  PlanSummary,
} from '../../core/models/plan.model';
import { Vibe, VIBES } from '../../core/models/vibe.model';
import { CatalogService } from '../../core/services/catalog.service';
import { PlanService } from '../../core/services/plan.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { ModalComponent } from '../../shared/ui/modal.component';
import { AutoplanDialogComponent } from './autoplan-dialog.component';

const INPUT = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500';

/** Danh sách plan của mình; tạo plan trống hoặc để Autoplan dựng sẵn từ khu vực. */
@Component({
  selector: 'app-plan-list-page',
  imports: [AutoplanDialogComponent, RouterLink, IconComponent, ModalComponent],
  template: `
    <div class="flex flex-col gap-4 px-4 pb-10 pt-4 sm:px-6 lg:px-8 lg:pt-5">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col gap-1.5">
          <h1 class="text-2xl font-extrabold tracking-tight text-slate-900">Plan</h1>
          <p class="text-[13px] text-slate-500">Lên lịch trình buổi hẹn: điểm 1 → điểm 2 → … Tự làm, hoặc để Autoplan dựng sẵn.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="flex min-h-10 items-center gap-2 rounded-xl border border-brand-200 bg-white px-4 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
            (click)="openCreate()"
          >
            <app-icon name="plus" [size]="18" [stroke]="2.4" />Tạo plan
          </button>
          <button
            type="button"
            class="flex min-h-10 items-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700"
            (click)="openAuto()"
          >
            <app-icon name="shuffle" [size]="18" />Autoplan
          </button>
        </div>
      </header>

      @if (loaded() && plans().length === 0) {
        <div class="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-brand-200 bg-white px-6 py-14 text-center">
          <span class="text-brand-600"><app-icon name="route" [size]="36" /></span>
          <p class="text-lg font-semibold text-slate-900">Chưa có plan nào</p>
          <p class="max-w-md text-sm text-slate-500">Chọn một khu vực và bấm Autoplan: app dựng sẵn lịch trình gồm chỗ chơi, quán ăn, cafe gần nhau. Sửa tiếp theo ý bạn.</p>
          <button type="button" class="mt-2 flex min-h-10 items-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700" (click)="openAuto()">
            <app-icon name="shuffle" [size]="18" />Thử Autoplan
          </button>
        </div>
      } @else {
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          @for (p of plans(); track p.id) {
            <a
              [routerLink]="['/plans', p.id]"
              class="flex flex-col overflow-hidden rounded-2xl border border-brand-100 bg-white transition hover:border-brand-300 hover:shadow-md"
            >
              <div class="relative h-28 bg-brand-50">
                @if (p.imageUrl) {
                  <img [src]="p.imageUrl" alt="" class="h-full w-full object-cover" loading="lazy" />
                } @else {
                  <div class="flex h-full items-center justify-center text-brand-300"><app-icon name="route" [size]="40" /></div>
                }
                <span class="absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold" [class]="status(p).classes">{{ status(p).label }}</span>
              </div>
              <div class="flex flex-1 flex-col gap-2 p-4">
                <h2 class="text-base font-bold text-slate-900">{{ p.title }}</h2>
                <p class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-500">
                  <span class="flex items-center gap-1"><app-icon name="calendar" [size]="14" />{{ p.date ? dateText(p.date) : 'Chưa chọn ngày' }} · {{ p.startTime }}</span>
                  @if (p.districtLabel) {
                    <span class="flex items-center gap-1"><app-icon name="pin" [size]="14" />{{ p.districtLabel }}</span>
                  }
                </p>
                @if (p.stopCount) {
                  <p class="text-[13px] text-slate-700">
                    {{ p.stopNames.join(' → ') }}@if (p.stopCount > p.stopNames.length) { → … }
                  </p>
                } @else {
                  <p class="text-[13px] italic text-slate-400">Chưa có điểm nào</p>
                }
              </div>
            </a>
          }
        </div>
      }
    </div>

    @if (createOpen()) {
      <app-modal title="Tạo plan" subtitle="Thêm điểm sau khi tạo" width="max-w-md" (dismiss)="createOpen.set(false)">
        <div class="space-y-4">
          <label class="block text-sm font-medium text-slate-700">
            Tên plan
            <input class="mt-1.5 {{ input }}" maxlength="120" [value]="title()" (input)="title.set($any($event.target).value)" placeholder="Ví dụ: Tối thứ 7 ở Hoàn Kiếm" />
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="block text-sm font-medium text-slate-700">
              Ngày
              <input type="date" class="mt-1.5 {{ input }}" [value]="date()" (input)="date.set($any($event.target).value)" />
            </label>
            <label class="block text-sm font-medium text-slate-700">
              Bắt đầu
              <input type="time" class="mt-1.5 {{ input }}" [value]="startTime()" (input)="startTime.set($any($event.target).value)" />
            </label>
          </div>
          <label class="block text-sm font-medium text-slate-700">
            Khu vực chính
            <select class="mt-1.5 {{ input }}" [value]="district()" (change)="district.set($any($event.target).value)">
              <option value="">Chưa chọn</option>
              @for (d of districts(); track d.code) {
                <option [value]="d.code">{{ d.label }}</option>
              }
            </select>
          </label>
        </div>
        <div modalFooter class="flex gap-2">
          <button type="button" class="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600" (click)="createOpen.set(false)">Huỷ</button>
          <button type="button" class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50" [disabled]="!title().trim() || busy()" (click)="create()">Tạo</button>
        </div>
      </app-modal>
    }

    @if (autoOpen()) {
      <app-autoplan-dialog (closed)="autoOpen.set(false)" />
    }
  `,
})
export class PlanListPage implements OnInit {
  private readonly plansApi = inject(PlanService);
  private readonly catalog = inject(CatalogService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly input = INPUT;
  protected readonly slots = PLAN_SLOTS;
  protected readonly budgets = PLAN_BUDGETS;
  protected readonly vibes = VIBES;

  protected readonly plans = signal<PlanSummary[]>([]);
  protected readonly loaded = signal(false);
  protected readonly districts = signal<DistrictOption[]>([]);
  protected readonly createOpen = signal(false);
  protected readonly autoOpen = signal(false);
  protected readonly busy = signal(false);

  protected readonly title = signal('');
  protected readonly date = signal('');
  protected readonly startTime = signal('18:00');
  protected readonly district = signal('');
  protected readonly slot = signal<PlanSlot>('evening');
  protected readonly vibe = signal<Vibe | null>(null);
  protected readonly budgetIndex = signal(0);
  protected readonly rainy = signal(false);

  async ngOnInit(): Promise<void> {
    const [plans, districts] = await Promise.all([this.plansApi.list(), this.catalog.districts()]);
    this.plans.set(plans);
    this.districts.set(districts);
    this.loaded.set(true);
  }

  protected status(p: PlanSummary) {
    return planStatusMeta(p.status);
  }

  protected dateText(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  protected openCreate(): void {
    this.title.set('');
    this.createOpen.set(true);
  }

  protected openAuto(): void {
    this.autoOpen.set(true);
  }

  protected async create(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const plan = await this.plansApi.create({
        title: this.title().trim(),
        date: this.date() || null,
        startTime: this.startTime() || '18:00',
        district: this.district() || null,
        note: '',
        vibe: null,
        budget: null,
        rainy: false,
      });
      this.createOpen.set(false);
      await this.router.navigate(['/plans', plan.id]);
    } finally {
      this.busy.set(false);
    }
  }
}
