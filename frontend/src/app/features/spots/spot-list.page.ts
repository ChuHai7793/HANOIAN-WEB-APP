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
  imports: [SpotFormComponent, ConfirmDialogComponent],
  template: `
    <div class="p-4 sm:p-6 lg:p-8">
      <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <span>🎡</span> Tìm chỗ chơi
          </h1>
          <p class="mt-1 text-sm text-slate-500">
            Music box, workshop, bảo tàng, dạo phố… những chỗ hẹn hò ở Hà Nội ngoài quán xá.
          </p>
        </div>
        @if (canEdit()) {
          <button
            type="button"
            class="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
            (click)="openCreate()"
          >
            + Thêm chỗ chơi
          </button>
        }
      </div>

      <div class="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          [value]="q()"
          (input)="onSearch($any($event.target).value)"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 sm:w-72"
          placeholder="Tìm theo tên, địa chỉ…"
        />
        <select
          [value]="district()"
          (change)="district.set($any($event.target).value); reload()"
          class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
        >
          <option value="">Mọi khu vực</option>
          @for (d of districts(); track d.code) {
            <option [value]="d.code">{{ d.label }}</option>
          }
        </select>
        <select
          [value]="budgetIndex()"
          (change)="budgetIndex.set(+$any($event.target).value); reload()"
          class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
        >
          @for (b of budgets; track $index) {
            <option [value]="$index">{{ b.label }}</option>
          }
        </select>
        <label class="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
          <input type="checkbox" [checked]="openNow()" (change)="openNow.set(!openNow()); reload()" class="h-4 w-4 accent-brand-600" />
          Đang mở cửa
        </label>
        <label class="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
          <input type="checkbox" [checked]="rainy()" (change)="rainy.set(!rainy()); reload()" class="h-4 w-4 accent-brand-600" />
          ☔ Ngày mưa
        </label>
      </div>

      <div class="mb-5 flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-full px-3.5 py-1.5 text-xs font-medium transition"
          [class]="category() === '' ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'"
          (click)="category.set(''); reload()"
        >
          Tất cả
        </button>
        @for (c of categories; track c.value) {
          <button
            type="button"
            class="rounded-full px-3.5 py-1.5 text-xs font-medium transition"
            [class]="category() === c.value ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'"
            (click)="category.set(c.value); reload()"
          >
            {{ c.icon }} {{ c.label }}
          </button>
        }
      </div>

      @if (loading() && items().length === 0) {
        <p class="text-sm text-slate-500">Đang tải…</p>
      } @else if (items().length === 0) {
        <p class="text-sm text-slate-500">
          {{ hasFilter() ? 'Không tìm thấy chỗ nào hợp bộ lọc.' : 'Chưa có chỗ chơi nào.' }}
        </p>
      } @else {
        <p class="mb-3 text-xs text-slate-400">{{ total() }} chỗ chơi</p>
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          @for (item of items(); track item.id) {
            <article class="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              @if (item.imageUrl) {
                <img [src]="item.imageUrl" alt="" class="h-36 w-full object-cover" loading="lazy" />
              }
              <div class="flex flex-1 flex-col p-4">
                <div class="flex items-start gap-2">
                  <span class="text-xl">{{ cat(item).icon }}</span>
                  <div class="min-w-0 flex-1">
                    <p class="font-semibold text-slate-900">{{ item.name }}</p>
                    <p class="text-xs text-slate-500">
                      {{ cat(item).label }} · {{ item.address || 'Chưa có địa chỉ' }} · {{ item.districtLabel }}
                    </p>
                  </div>
                </div>
                <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span class="font-medium" [class]="item.priceFrom === 0 && !item.priceTo ? 'text-emerald-600' : 'text-slate-700'">
                    {{ price(item) }}
                  </span>
                  <span>🕐 {{ item.openTime ? item.openTime + '–' + item.closeTime : 'Không giờ cố định' }}</span>
                  @if (item.durationMin) {
                    <span>⏱ {{ duration(item.durationMin) }}</span>
                  }
                  <span>{{ item.indoor ? '🏠 Trong nhà' : '🌤 Ngoài trời' }}</span>
                </div>
                @if (item.needsBooking) {
                  <p class="mt-2">
                    <span class="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">📅 Cần đặt trước</span>
                  </p>
                }
                @if (item.description) {
                  <p class="mt-2 line-clamp-3 text-xs text-slate-600">{{ item.description }}</p>
                }
                @if (item.hoursNote) {
                  <p class="mt-1 text-xs italic text-slate-500">{{ item.hoursNote }}</p>
                }
                <div class="mt-auto flex flex-wrap items-center gap-2 pt-3 text-xs">
                  <a
                    [href]="mapUrl(item)"
                    target="_blank"
                    rel="noopener"
                    class="rounded-lg border border-slate-200 px-2.5 py-1.5 font-medium text-slate-600 hover:bg-slate-50"
                    >🗺️ Maps</a
                  >
                  <a
                    [href]="directions(item)"
                    target="_blank"
                    rel="noopener"
                    class="rounded-lg border border-slate-200 px-2.5 py-1.5 font-medium text-slate-600 hover:bg-slate-50"
                    >🧭 Chỉ đường</a
                  >
                  @if (item.bookingUrl) {
                    <a
                      [href]="item.bookingUrl"
                      target="_blank"
                      rel="noopener"
                      class="rounded-lg bg-brand-600 px-2.5 py-1.5 font-semibold text-white hover:bg-brand-700"
                      >Đặt chỗ</a
                    >
                  }
                  @if (canEdit()) {
                    <span class="flex-1"></span>
                    <button type="button" class="rounded-lg border border-slate-200 px-2 py-1.5 hover:bg-slate-50" title="Sửa" (click)="openEdit(item)">✏️</button>
                    <button type="button" class="rounded-lg border border-slate-200 px-2 py-1.5 text-rose-600 hover:bg-rose-50" title="Xoá" (click)="pendingDelete.set(item)">🗑️</button>
                  }
                </div>
              </div>
            </article>
          }
        </div>
        @if (items().length < total()) {
          <div class="mt-5 text-center">
            <button
              type="button"
              class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
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

  protected async reload(): Promise<void> {
    this.page = 0;
    await this.load(false);
  }

  protected async loadMore(): Promise<void> {
    this.page++;
    await this.load(true);
  }

  private async load(append: boolean): Promise<void> {
    const seq = ++this.requestSeq;
    this.loading.set(true);
    try {
      const res = await this.spots.search({
        q: this.q().trim(),
        category: this.category(),
        district: this.district(),
        maxPrice: BUDGETS[this.budgetIndex()].value,
        indoor: this.rainy() ? true : null,
        openAt: this.openNow() ? nowHHmm() : '',
        page: this.page,
        size: 30,
      });
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
