import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import {
  CatalogItem,
  cuisineOption,
  DistrictOption,
  openingHoursRange,
} from '../../core/models/catalog.model';
import { Place, PLACE_ICONS, PlaceType } from '../../core/models/place.model';
import { CatalogService } from '../../core/services/catalog.service';
import { PlaceService } from '../../core/services/place.service';
import { ToastService } from '../../core/services/toast.service';
import { directionsUrl, viewOnMapUrl } from '../../core/utils/gmap-url';
import { PlaceFormComponent } from '../places/place-form.component';
import { BAR_CONFIG, CAFE_CONFIG, PlaceTypeConfig, RESTAURANT_CONFIG } from '../places/place.config';

const CONFIGS: Record<PlaceType, PlaceTypeConfig> = {
  cafe: CAFE_CONFIG,
  restaurant: RESTAURANT_CONFIG,
  bar: BAR_CONFIG,
};

const TYPE_FILTERS: { value: PlaceType | ''; label: string }[] = [
  { value: '', label: 'Tất cả' },
  { value: 'cafe', label: '☕ Cafe' },
  { value: 'restaurant', label: '🍜 Nhà hàng' },
  { value: 'bar', label: '🍸 Bar' },
];

/**
 * "Khám phá quán": danh mục lấy từ OpenStreetMap, ai đăng nhập cũng xem được. Admin bấm "Thêm vào
 * sổ tay" để mở form quán đã điền sẵn, chấm điểm rồi lưu vào sổ tay (places).
 */
@Component({
  selector: 'app-explore-page',
  imports: [DatePipe, RouterLink, PlaceFormComponent],
  template: `
    <div class="p-4 sm:p-6 lg:p-8">
      <div class="mb-6">
        <h1 class="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <span>🔎</span> Khám phá quán
        </h1>
        <p class="mt-1 text-sm text-slate-500">
          Quán cafe, nhà hàng, bar ở Hà Nội. Thấy quán ưng ý thì thêm vào sổ tay để chấm điểm, ghi chú.
        </p>
      </div>

      @if (canEdit()) {
        <div
          class="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-600"
        >
          <span class="flex-1">
            @if (lastFetchedAt(); as at) {
              Cập nhật lần cuối: {{ at | date: 'dd/MM/yyyy HH:mm' }} · {{ total() }} quán
            } @else {
              Danh mục còn trống.
            }
          </span>
          <a routerLink="/admin/catalog" class="font-medium text-brand-600 hover:text-brand-700">
            Cập nhật dữ liệu →
          </a>
        </div>
      }

      <div class="mb-5 flex flex-wrap items-center gap-2">
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
          <option value="">Mọi quận</option>
          @for (d of districts(); track d.code) {
            <option [value]="d.code">{{ d.label }}</option>
          }
        </select>
        @for (t of typeFilters; track t.value) {
          <button
            type="button"
            class="rounded-full px-3.5 py-1.5 text-xs font-medium transition"
            [class]="type() === t.value ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'"
            (click)="type.set(t.value); reload()"
          >
            {{ t.label }}
          </button>
        }
      </div>

      @if (loading() && items().length === 0) {
        <p class="text-sm text-slate-500">Đang tải…</p>
      } @else if (items().length === 0) {
        <p class="text-sm text-slate-500">
          {{ total() === 0 && !q() && !type() && !district() ? 'Chưa có dữ liệu. Admin cần nhập từ OpenStreetMap trước.' : 'Không tìm thấy quán nào.' }}
        </p>
      } @else {
        <p class="mb-3 text-xs text-slate-400">{{ total() }} quán</p>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          @for (item of items(); track item.id) {
            <div class="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div class="flex items-start gap-2">
                <span class="text-xl">{{ icons[item.type] }}</span>
                <div class="min-w-0 flex-1">
                  <p class="font-semibold text-slate-900">{{ item.name }}</p>
                  <p class="text-xs text-slate-500">
                    {{ item.address || 'Chưa có địa chỉ' }}
                    @if (item.district) {
                      · {{ item.district }}
                    }
                  </p>
                </div>
              </div>
              <div class="mt-2 flex flex-wrap gap-1.5 text-[11px] text-slate-500">
                @if (item.openingHours) {
                  <span class="rounded bg-slate-100 px-1.5 py-0.5">🕐 {{ item.openingHours }}</span>
                }
                @if (item.cuisine) {
                  <span class="rounded bg-slate-100 px-1.5 py-0.5">{{ item.cuisine }}</span>
                }
                @if (item.hasWifi) {
                  <span class="rounded bg-slate-100 px-1.5 py-0.5">📶 Wifi</span>
                }
              </div>
              <div class="mt-auto flex flex-wrap items-center gap-2 pt-3 text-xs">
                <a
                  [href]="mapUrl(item)"
                  target="_blank"
                  rel="noopener"
                  class="rounded-lg border border-slate-200 px-2.5 py-1.5 font-medium text-slate-600 hover:bg-slate-50"
                  >🗺️ Google Maps</a
                >
                <a
                  [href]="directions(item)"
                  target="_blank"
                  rel="noopener"
                  class="rounded-lg border border-slate-200 px-2.5 py-1.5 font-medium text-slate-600 hover:bg-slate-50"
                  >🧭 Chỉ đường</a
                >
                <span class="flex-1"></span>
                @if (item.inNotebook) {
                  <span class="font-medium text-emerald-600">✓ Đã có trong sổ tay</span>
                } @else if (canEdit()) {
                  <button
                    type="button"
                    class="rounded-lg bg-brand-600 px-2.5 py-1.5 font-semibold text-white hover:bg-brand-700"
                    (click)="adding.set(item)"
                  >
                    + Thêm vào sổ tay
                  </button>
                }
              </div>
            </div>
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

      <p class="mt-8 text-center text-[11px] text-slate-400">
        Dữ liệu ©
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" class="underline"
          >OpenStreetMap contributors</a
        >
      </p>
    </div>

    @if (adding(); as item) {
      <app-place-form
        [config]="configs[item.type]"
        [draft]="draftOf(item)"
        (save)="addToNotebook(item, $event)"
        (cancel)="adding.set(null)"
      />
    }
  `,
})
export class ExplorePage implements OnInit {
  private readonly catalog = inject(CatalogService);
  private readonly placeService = inject(PlaceService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  protected readonly icons = PLACE_ICONS;
  protected readonly configs = CONFIGS;
  protected readonly typeFilters = TYPE_FILTERS;
  protected readonly canEdit = this.auth.canEdit;

  protected readonly q = signal('');
  protected readonly type = signal<PlaceType | ''>('');
  protected readonly district = signal('');
  protected readonly districts = signal<DistrictOption[]>([]);
  protected readonly items = signal<CatalogItem[]>([]);
  protected readonly total = signal(0);
  protected readonly lastFetchedAt = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly adding = signal<CatalogItem | null>(null);
  private readonly saving = signal(false);
  private page = 0;
  private searchTimer?: ReturnType<typeof setTimeout>;
  /** Bỏ kết quả của lần tải cũ nếu người dùng đã đổi bộ lọc */
  private requestSeq = 0;

  async ngOnInit(): Promise<void> {
    void this.catalog.districts().then((d) => this.districts.set(d));
    await this.reload();
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
      const res = await this.catalog.search({
        q: this.q().trim(),
        type: this.type(),
        district: this.district(),
        page: this.page,
        size: 30,
      });
      if (seq !== this.requestSeq) return;
      this.items.set(append ? [...this.items(), ...res.items] : res.items);
      this.total.set(res.total);
      this.lastFetchedAt.set(res.lastFetchedAt);
    } finally {
      if (seq === this.requestSeq) this.loading.set(false);
    }
  }

  protected mapUrl(item: CatalogItem): string {
    return viewOnMapUrl(item.lat, item.lng, item.name);
  }

  protected directions(item: CatalogItem): string {
    return directionsUrl(item.lat, item.lng, item.name);
  }

  /** Điền sẵn form quán từ dữ liệu OSM; điểm và mức giá để người dùng tự chọn. */
  protected draftOf(item: CatalogItem): Partial<Place> {
    const hours = openingHoursRange(item.openingHours);
    return {
      name: item.name,
      address: [item.address, item.district].filter(Boolean).join(', '),
      lat: item.lat,
      lng: item.lng,
      googleMapsUrl: viewOnMapUrl(item.lat, item.lng, item.name),
      openTime: hours?.open,
      closeTime: hours?.close,
      cuisine: cuisineOption(item.cuisine),
      hasWifi: item.hasWifi ?? undefined,
    };
  }

  protected async addToNotebook(item: CatalogItem, place: Place): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    const { id, ...data } = place;
    try {
      // catalogId: để danh mục đánh dấu "Đã có trong sổ tay"
      await this.placeService.create({ ...data, catalogId: item.id } as Omit<Place, 'id'>);
      this.items.update((list) => list.map((i) => (i.id === item.id ? { ...i, inNotebook: true } : i)));
      this.adding.set(null);
      this.toast.success(`Đã thêm "${place.name}" vào sổ tay.`);
    } catch {
      // errorInterceptor đã hiện thông báo; giữ form để thử lại
    } finally {
      this.saving.set(false);
    }
  }
}
