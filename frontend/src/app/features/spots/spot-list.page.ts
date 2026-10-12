import { Component, inject, OnInit, signal } from '@angular/core';
import { errorCode, problemOf } from '../../core/api/api';
import { AuthService } from '../../core/auth/auth.service';
import { DistrictOption } from '../../core/models/catalog.model';
import {
  durationText,
  SPOT_CATEGORIES,
  SpotCategory,
  spotCategory,
  SpotItem,
  spotPriceText,
} from '../../core/models/spot.model';
import { CatalogService } from '../../core/services/catalog.service';
import { SpotRequest, SpotService } from '../../core/services/spot.service';
import { ToastService } from '../../core/services/toast.service';
import { directionsUrl, viewOnMapUrl } from '../../core/utils/gmap-url';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { SpotFormComponent } from './spot-form.component';

/** Lọc theo ngân sách: giá thấp nhất của chỗ chơi không quá mức này. */
const BUDGETS: { value: number | null; label: string }[] = [
  { value: null, label: 'Mọi mức giá' },
  { value: 0, label: 'Miễn phí' },
  { value: 200_000, label: 'Dưới 200k' },
  { value: 500_000, label: 'Dưới 500k' },
];

/** Giờ hiện tại của máy người xem, dạng "HH:mm" */
function nowHHmm(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * "Tìm chỗ chơi": chỗ hẹn hò không phải quán (music box, workshop, bảo tàng, dạo hồ...) do admin nhập.
 * Mọi người xem và lọc; chỉ admin thấy nút thêm mới, sửa, xoá.
 */
@Component({
  selector: 'app-spot-list-page',
  imports: [SpotFormComponent, ConfirmDialogComponent, IconComponent],
  template: `
    <div class="flex flex-col gap-6 px-4 pb-14 pt-6 sm:px-6 lg:px-10 lg:pt-8">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col gap-1.5">
          <h1 class="text-[32px] font-extrabold tracking-tight text-slate-900">Tìm chỗ chơi</h1>
          <p class="text-[15px] text-slate-500">
            Music box, workshop, bảo tàng, dạo phố… những chỗ hẹn hò ở Hà Nội ngoài quán xá.
          </p>
        </div>
        @if (canEdit()) {
          <button
            type="button"
            class="flex min-h-11 items-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700"
            (click)="openCreate()"
          >
            <app-icon name="plus" [size]="18" [stroke]="2.4" />
            Thêm chỗ chơi
          </button>
        }
      </header>

      <div class="flex flex-wrap items-center gap-3">
        <label class="flex min-h-11 max-w-[420px] flex-[1_1_280px] items-center gap-2.5 rounded-xl border border-brand-200 bg-white px-3.5 text-slate-500">
          <app-icon name="search" [size]="18" />
          <span class="sr-only">Tìm chỗ chơi</span>
          <input
            type="search"
            [value]="q()"
            (input)="onSearch($any($event.target).value)"
            class="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            placeholder="Tìm theo tên, địa chỉ…"
          />
        </label>
        <label class="flex min-h-11 items-center gap-2 rounded-xl border border-brand-200 bg-white px-3 text-sm text-slate-700">
          <span class="text-brand-600"><app-icon name="pin" [size]="18" /></span>
          <span class="sr-only">Khu vực</span>
          <select
            [value]="district()"
            (change)="district.set($any($event.target).value); reload()"
            class="cursor-pointer bg-transparent text-sm text-slate-900 outline-none"
          >
            <option value="">Mọi khu vực</option>
            @for (d of districts(); track d.code) {
              <option [value]="d.code">{{ d.label }}</option>
            }
          </select>
        </label>
        <label class="flex min-h-11 items-center rounded-xl border border-brand-200 bg-white px-3 text-sm text-slate-700">
          <span class="sr-only">Ngân sách</span>
          <select
            [value]="budgetIndex()"
            (change)="budgetIndex.set(+$any($event.target).value); reload()"
            class="cursor-pointer bg-transparent text-sm text-slate-900 outline-none"
          >
            @for (b of budgets; track $index) {
              <option [value]="$index">{{ b.label }}</option>
            }
          </select>
        </label>
        <button
          type="button"
          [attr.aria-pressed]="openNow()"
          class="flex min-h-11 items-center gap-1.5 rounded-xl border px-3.5 text-sm transition"
          [class]="openNow() ? 'border-brand-600 bg-brand-600 font-semibold text-white' : 'border-brand-200 bg-white text-slate-700 hover:bg-brand-50'"
          (click)="openNow.set(!openNow()); reload()"
        >
          <app-icon name="clock" [size]="16" />Đang mở cửa
        </button>
        <button
          type="button"
          [attr.aria-pressed]="rainy()"
          class="flex min-h-11 items-center gap-1.5 rounded-xl border px-3.5 text-sm transition"
          [class]="rainy() ? 'border-brand-600 bg-brand-600 font-semibold text-white' : 'border-brand-200 bg-white text-slate-700 hover:bg-brand-50'"
          (click)="rainy.set(!rainy()); reload()"
        >
          ☔ Ngày mưa
        </button>
      </div>

      <div role="group" aria-label="Nhóm chỗ chơi" class="-mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          [attr.aria-pressed]="category() === ''"
          class="min-h-10 rounded-full border px-4 text-sm transition"
          [class]="category() === '' ? 'border-brand-600 bg-brand-600 font-semibold text-white' : 'border-brand-200 bg-white font-medium text-slate-700 hover:bg-brand-50'"
          (click)="category.set(''); reload(false)"
        >
          Tất cả@if (counts(); as n) { · {{ n['all'] }}}
        </button>
        @for (c of categories; track c.value) {
          <button
            type="button"
            [attr.aria-pressed]="category() === c.value"
            class="min-h-10 rounded-full border px-4 text-sm transition"
            [class]="category() === c.value ? 'border-brand-600 bg-brand-600 font-semibold text-white' : 'border-brand-200 bg-white font-medium text-slate-700 hover:bg-brand-50'"
            (click)="category.set(c.value); reload(false)"
          >
            {{ c.icon }} {{ c.label }}@if (counts(); as n) { · {{ n[c.value] }}}
          </button>
        }
      </div>

      @if (loading() && items().length === 0) {
        <p class="text-sm text-slate-500">Đang tải…</p>
      } @else if (items().length === 0) {
        <div class="rounded-[20px] border border-dashed border-brand-300 bg-white px-6 py-12 text-center text-[15px] text-slate-500">
          {{ hasFilter() ? 'Không tìm thấy chỗ nào hợp bộ lọc. Thử bỏ bớt bộ lọc nhé.' : 'Chưa có chỗ chơi nào.' }}
        </div>
      } @else {
        <span class="text-[13px] text-slate-500">{{ total() }} chỗ chơi</span>
        <div class="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6">
          @for (item of items(); track item.id) {
            <article class="flex flex-col overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(48,30,110,0.04),0_8px_24px_rgba(48,30,110,0.05)]">
              <div class="relative flex h-44 items-center justify-center bg-[#EFEAFC] text-5xl">
                @if (item.imageUrl) {
                  <img [src]="item.imageUrl" alt="" class="h-full w-full object-cover" loading="lazy" />
                } @else {
                  <span aria-hidden="true">{{ cat(item).icon }}</span>
                }
                <span class="absolute left-3 top-3 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-brand-800">
                  {{ cat(item).label }}
                </span>
                <span class="absolute right-3 top-3 rounded-full bg-slate-900/70 px-2.5 py-1 text-xs font-medium text-white">
                  {{ item.districtLabel }}
                </span>
                @if (item.needsBooking) {
                  <span class="absolute bottom-3 left-3 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                    Cần đặt trước
                  </span>
                }
              </div>
              <div class="flex flex-1 flex-col gap-2.5 px-5 pb-5 pt-[18px]">
                <div class="flex flex-col gap-1">
                  <h2 class="text-lg font-bold tracking-tight text-slate-900">{{ item.name }}</h2>
                  <span class="text-[13px] leading-snug text-slate-500">{{ item.address || 'Chưa có địa chỉ' }}</span>
                </div>
                <div class="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[13px] text-slate-700">
                  <span class="font-semibold" [class]="item.priceFrom === 0 && !item.priceTo ? 'text-emerald-600' : 'text-slate-900'">
                    {{ price(item) }}
                  </span>
                  <span class="flex items-center gap-1">
                    <span class="text-slate-500"><app-icon name="clock" [size]="14" /></span>
                    {{ item.openTime ? item.openTime + '–' + item.closeTime : 'Không giờ cố định' }}
                  </span>
                  @if (item.durationMin) {
                    <span>⏱ {{ duration(item.durationMin) }}</span>
                  }
                  <span>{{ item.indoor ? 'Trong nhà' : 'Ngoài trời' }}</span>
                </div>
                @if (item.description) {
                  <p class="line-clamp-3 text-sm leading-relaxed text-slate-600">{{ item.description }}</p>
                }
                @if (item.hoursNote) {
                  <p class="text-[13px] italic text-slate-500">{{ item.hoursNote }}</p>
                }
                <div class="mt-auto flex flex-wrap items-center gap-2 pt-1.5">
                  <a
                    [href]="mapUrl(item)"
                    target="_blank"
                    rel="noopener"
                    class="flex min-h-10 items-center gap-1.5 rounded-[10px] border border-brand-200 px-3 text-[13px] font-medium text-slate-700 hover:bg-brand-50"
                  >
                    <app-icon name="pin" [size]="15" />Maps
                  </a>
                  <a
                    [href]="directions(item)"
                    target="_blank"
                    rel="noopener"
                    class="flex min-h-10 items-center gap-1.5 rounded-[10px] border border-brand-200 px-3 text-[13px] font-medium text-slate-700 hover:bg-brand-50"
                  >
                    <app-icon name="navigate" [size]="15" />Chỉ đường
                  </a>
                  @if (canEdit()) {
                    <button type="button" class="flex min-h-10 items-center rounded-[10px] border border-brand-200 px-2.5 text-slate-600 hover:bg-brand-50" title="Sửa" (click)="openEdit(item)">
                      <app-icon name="edit" [size]="15" />
                    </button>
                    <button type="button" class="flex min-h-10 items-center rounded-[10px] border border-brand-200 px-2.5 text-rose-600 hover:bg-rose-50" title="Xoá" (click)="pendingDelete.set(item)">
                      <app-icon name="trash" [size]="15" />
                    </button>
                  }
                  @if (item.bookingUrl) {
                    <a
                      [href]="item.bookingUrl"
                      target="_blank"
                      rel="noopener"
                      class="ml-auto flex min-h-10 items-center gap-1.5 rounded-[10px] bg-brand-600 px-3.5 text-[13px] font-semibold text-white hover:bg-brand-700"
                    >
                      <app-icon name="calendar" [size]="15" />Đặt chỗ
                    </a>
                  }
                </div>
              </div>
            </article>
          }
        </div>
        @if (items().length < total()) {
          <div class="text-center">
            <button
              type="button"
              class="min-h-11 rounded-xl border border-brand-200 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-brand-50 disabled:opacity-60"
              [disabled]="loading()"
              (click)="loadMore()"
            >
              {{ loading() ? 'Đang tải…' : 'Xem thêm' }}
            </button>
          </div>
        }
      }
    </div>

    @if (formOpen()) {
      <app-spot-form [spot]="editing()" [districts]="districts()" (save)="save($event)" (cancel)="closeForm()" />
    }

    @if (pendingDelete(); as target) {
      <app-confirm-dialog
        title="Xoá chỗ chơi?"
        [message]="'Xoá &quot;' + target.name + '&quot; khỏi Tìm chỗ chơi.'"
        (confirm)="confirmDelete()"
        (cancel)="pendingDelete.set(null)"
      />
    }
  `,
})
export class SpotListPage implements OnInit {
  private readonly spots = inject(SpotService);
  private readonly catalog = inject(CatalogService);
  private readonly toast = inject(ToastService);

  protected readonly categories = SPOT_CATEGORIES;
  protected readonly budgets = BUDGETS;
  protected readonly canEdit = inject(AuthService).canEdit;
  protected readonly cat = (item: SpotItem) => spotCategory(item.category);
  protected readonly price = spotPriceText;
  protected readonly duration = durationText;

  protected readonly q = signal('');
  protected readonly category = signal<SpotCategory | ''>('');
  protected readonly district = signal('');
  protected readonly budgetIndex = signal(0);
  protected readonly openNow = signal(false);
  /** Ngày mưa: chỉ chỗ trong nhà */
  protected readonly rainy = signal(false);
  protected readonly districts = signal<DistrictOption[]>([]);
  protected readonly items = signal<SpotItem[]>([]);
  /** Số chỗ chơi theo nhóm cho chip (theo mọi bộ lọc trừ nhóm) */
  protected readonly counts = signal<Record<string, number> | null>(null);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);

  protected readonly formOpen = signal(false);
  protected readonly editing = signal<SpotItem | null>(null);
  protected readonly pendingDelete = signal<SpotItem | null>(null);
  private readonly saving = signal(false);

  private page = 0;
  private searchTimer?: ReturnType<typeof setTimeout>;
  /** Bỏ kết quả của lần tải cũ nếu người dùng đã đổi bộ lọc */
  private requestSeq = 0;

  async ngOnInit(): Promise<void> {
    void this.catalog.districts().then((d) => this.districts.set(d));
    await this.reload();
  }

  protected hasFilter(): boolean {
    return !!(this.q() || this.category() || this.district() || this.budgetIndex() || this.openNow() || this.rainy());
  }

  protected onSearch(value: string): void {
    this.q.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.reload(), 300);
  }

  /** {@code withCounts}: tính lại số trên chip (đổi nhóm thì không cần, số không theo nhóm). */
  protected async reload(withCounts = true): Promise<void> {
    this.page = 0;
    if (withCounts) {
      const filter = this.filter();
      const key = JSON.stringify(filter);
      void this.spots.counts(filter).then((c) => {
        // Bỏ kết quả cũ nếu bộ lọc đã đổi trong lúc chờ
        if (key === JSON.stringify(this.filter())) this.counts.set(c);
      });
    }
    await this.load(false);
  }

  /** Bộ lọc hiện tại, trừ nhóm và trang */
  private filter() {
    return {
      q: this.q().trim(),
      district: this.district(),
      maxPrice: BUDGETS[this.budgetIndex()].value,
      indoor: this.rainy() ? true : null,
      openAt: this.openNow() ? nowHHmm() : '',
    };
  }

  protected async loadMore(): Promise<void> {
    this.page++;
    await this.load(true);
  }

  private async load(append: boolean): Promise<void> {
    const seq = ++this.requestSeq;
    this.loading.set(true);
    try {
      const res = await this.spots.search({ ...this.filter(), category: this.category(), page: this.page, size: 30 });
      if (seq !== this.requestSeq) return;
      this.items.set(append ? [...this.items(), ...res.items] : res.items);
      this.total.set(res.total);
    } finally {
      if (seq === this.requestSeq) this.loading.set(false);
    }
  }

  protected mapUrl(item: SpotItem): string {
    return item.googleMapsUrl || viewOnMapUrl(item.lat, item.lng, `${item.name} ${item.address}`);
  }

  protected directions(item: SpotItem): string {
    return directionsUrl(item.lat, item.lng, `${item.name} ${item.address}`);
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.formOpen.set(true);
  }

  protected openEdit(item: SpotItem): void {
    this.editing.set(item);
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.editing.set(null);
  }

  protected async save(request: SpotRequest): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    const existing = this.editing();
    try {
      if (existing) {
        await this.spots.update(existing.id, { ...request, version: existing.version });
        this.toast.success('Đã lưu chỗ chơi.');
      } else {
        await this.spots.create(request);
        this.toast.success(`Đã thêm "${request.name}" vào Tìm chỗ chơi.`);
      }
      this.closeForm();
      await this.reload();
    } catch (err) {
      if (errorCode(err) === 'VERSION_CONFLICT') {
        const current = problemOf(err)?.current as SpotItem | undefined;
        if (current) {
          // Đóng rồi mở lại form để nạp bản mới nhất
          this.closeForm();
          setTimeout(() => this.openEdit(current));
        }
        this.toast.error('Chỗ chơi vừa được sửa ở nơi khác. Đã tải bản mới nhất, hãy kiểm tra rồi lưu lại.');
      }
      // Lỗi khác: errorInterceptor đã hiện thông báo, giữ form để sửa
    } finally {
      this.saving.set(false);
    }
  }

  protected async confirmDelete(): Promise<void> {
    const target = this.pendingDelete();
    if (!target) return;
    this.pendingDelete.set(null);
    try {
      await this.spots.remove(target.id);
      this.toast.success(`Đã xoá "${target.name}" khỏi Tìm chỗ chơi.`);
      await this.reload();
    } catch {
      // errorInterceptor đã hiện thông báo
    }
  }
}
