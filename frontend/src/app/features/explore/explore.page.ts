import { Component, inject, OnInit, signal } from '@angular/core';
import { errorCode, problemOf } from '../../core/api/api';
import { AuthService } from '../../core/auth/auth.service';
import { CatalogItem, DistrictOption, MY_PLACE_GROUP } from '../../core/models/catalog.model';
import { Place, PLACE_ICONS, PlaceType, priceLabel } from '../../core/models/place.model';
import { CatalogRequest, CatalogService } from '../../core/services/catalog.service';
import { PlaceService } from '../../core/services/place.service';
import { ToastService } from '../../core/services/toast.service';
import { directionsUrl, viewOnMapUrl } from '../../core/utils/gmap-url';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog.component';
import { RatingStarsComponent } from '../../shared/ui/rating-stars.component';
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
  { value: 'bar', label: '🍸 Bar' },
  { value: 'restaurant', label: '🍜 Quán ăn' },
];

/**
 * "Khám phá quán": danh mục quán do admin nhập. Mọi người xem, lọc theo khu vực và loại, rồi "Add vào
 * My place" (vào nhóm theo loại của quán). Chỉ admin thấy nút thêm mới, sửa, xoá.
 */
@Component({
  selector: 'app-explore-page',
  imports: [PlaceFormComponent, RatingStarsComponent, ConfirmDialogComponent],
  template: `
    <div class="p-4 sm:p-6 lg:p-8">
      <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <span>🔎</span> Khám phá quán
          </h1>
          <p class="mt-1 text-sm text-slate-500">
            Quán cafe, bar, quán ăn ở Hà Nội. Ưng quán nào thì "Add vào My place".
          </p>
        </div>
        @if (canEdit()) {
          <div class="relative">
            <button
              type="button"
              class="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
              (click)="typeMenuOpen.set(!typeMenuOpen())"
            >
              + Thêm mới
            </button>
            @if (typeMenuOpen()) {
              <div class="absolute right-0 z-30 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                @for (t of newTypes; track t.value) {
                  <button
                    type="button"
                    class="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    (click)="openCreate(t.value)"
                  >
                    {{ t.label }}
                  </button>
                }
              </div>
            }
          </div>
        }
      </div>

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
          <option value="">Mọi khu vực</option>
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
          {{ q() || type() || district() ? 'Không tìm thấy quán nào.' : 'Chưa có quán nào trong danh mục.' }}
        </p>
      } @else {
        <p class="mb-3 text-xs text-slate-400">{{ total() }} quán</p>
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          @for (item of items(); track item.id) {
            <article class="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              @if (item.imageUrl) {
                <img [src]="item.imageUrl" alt="" class="h-36 w-full object-cover" loading="lazy" />
              }
              <div class="flex flex-1 flex-col p-4">
                <div class="flex items-start gap-2">
                  <span class="text-xl">{{ icons[item.type] }}</span>
                  <div class="min-w-0 flex-1">
                    <p class="font-semibold text-slate-900">{{ item.name }}</p>
                    <p class="text-xs text-slate-500">
                      {{ item.address || 'Chưa có địa chỉ' }} · {{ item.districtLabel }}
                    </p>
                  </div>
                </div>
                <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <app-rating-stars [value]="item.rating" />
                  <span>{{ priceText(item) }}</span>
                  <span>🕐 {{ item.openTime }}–{{ item.closeTime }}</span>
                </div>
                @if (item.note) {
                  <p class="mt-2 line-clamp-2 text-xs text-slate-600">{{ item.note }}</p>
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
                  @if (canEdit()) {
                    <button type="button" class="rounded-lg border border-slate-200 px-2 py-1.5 hover:bg-slate-50" title="Sửa" (click)="openEdit(item)">✏️</button>
                    <button type="button" class="rounded-lg border border-slate-200 px-2 py-1.5 text-rose-600 hover:bg-rose-50" title="Xoá" (click)="pendingDelete.set(item)">🗑️</button>
                  }
                  <span class="flex-1"></span>
                  @if (item.inMyPlace) {
                    <span class="font-medium text-emerald-600">✓ Đã có trong My place</span>
                  } @else {
                    <button
                      type="button"
                      class="rounded-lg bg-brand-600 px-2.5 py-1.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                      [disabled]="adding() === item.id"
                      (click)="addToMyPlace(item)"
                    >
                      + Add vào My place
                    </button>
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

    @if (formType(); as type) {
      <app-place-form
        [config]="configs[type]"
        [place]="editing()"
        [districts]="districts()"
        (save)="save($event)"
        (cancel)="closeForm()"
      />
    }

    @if (pendingDelete(); as target) {
      <app-confirm-dialog
        title="Xoá quán khỏi Khám phá quán?"
        [message]="'Xoá &quot;' + target.name + '&quot; khỏi danh mục. Ai đã add quán này vào My place vẫn giữ bản đã lưu.'"
        (confirm)="confirmDelete()"
        (cancel)="pendingDelete.set(null)"
      />
    }
  `,
})
export class ExplorePage implements OnInit {
  private readonly catalog = inject(CatalogService);
  private readonly placeService = inject(PlaceService);
  private readonly toast = inject(ToastService);

  protected readonly icons = PLACE_ICONS;
  protected readonly configs = CONFIGS;
  protected readonly typeFilters = TYPE_FILTERS;
  protected readonly newTypes = TYPE_FILTERS.filter((t) => t.value !== '') as { value: PlaceType; label: string }[];
  protected readonly canEdit = inject(AuthService).canEdit;

  protected readonly q = signal('');
  protected readonly type = signal<PlaceType | ''>('');
  protected readonly district = signal('');
  protected readonly districts = signal<DistrictOption[]>([]);
  protected readonly items = signal<CatalogItem[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  /** id quán đang được add vào My place */
  protected readonly adding = signal<string | null>(null);

  protected readonly typeMenuOpen = signal(false);
  /** Loại quán của form đang mở (null = đóng) */
  protected readonly formType = signal<PlaceType | null>(null);
  protected readonly editing = signal<Place | null>(null);
  protected readonly pendingDelete = signal<CatalogItem | null>(null);
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
    } finally {
      if (seq === this.requestSeq) this.loading.set(false);
    }
  }

  protected priceText(item: CatalogItem): string {
    return priceLabel(item.priceRange);
  }

  protected mapUrl(item: CatalogItem): string {
    return item.googleMapsUrl || viewOnMapUrl(item.lat, item.lng, `${item.name} ${item.address}`);
  }

  protected directions(item: CatalogItem): string {
    return directionsUrl(item.lat, item.lng, `${item.name} ${item.address}`);
  }

  /** Vào đúng nhóm theo loại của quán; thông báo "Đã được add vào Quán cafe/bar/ăn". */
  protected async addToMyPlace(item: CatalogItem): Promise<void> {
    this.adding.set(item.id);
    try {
      await this.catalog.addToMyPlace(item.id);
      this.markInMyPlace(item.id);
      this.toast.success(`Đã được add vào ${MY_PLACE_GROUP[item.type]}.`);
      void this.placeService.load();
    } catch (err) {
      if (errorCode(err) === 'ALREADY_IN_MY_PLACE') {
        this.markInMyPlace(item.id);
        this.toast.success(`Quán này đã có trong ${MY_PLACE_GROUP[item.type]}.`);
      }
      // Lỗi khác: errorInterceptor đã hiện thông báo
    } finally {
      this.adding.set(null);
    }
  }

  protected openCreate(type: PlaceType): void {
    this.typeMenuOpen.set(false);
    this.editing.set(null);
    this.formType.set(type);
  }

  protected openEdit(item: CatalogItem): void {
    this.editing.set(item);
    this.formType.set(item.type);
  }

  protected closeForm(): void {
    this.formType.set(null);
    this.editing.set(null);
  }

  protected async save(place: Place): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    const existing = this.editing();
    const { id: _id, createdAt: _c, updatedAt: _u, version: _v, district, ...fields } = place;
    const request: CatalogRequest = { ...fields, district: district ?? '' };
    try {
      if (existing) {
        await this.catalog.update(existing.id, { ...request, version: existing.version });
        this.toast.success('Đã lưu quán. My place của mọi người cũng được cập nhật.');
      } else {
        await this.catalog.create(request);
        this.toast.success(`Đã thêm "${place.name}" vào Khám phá quán.`);
      }
      this.closeForm();
      await this.reload();
    } catch (err) {
      if (errorCode(err) === 'VERSION_CONFLICT') {
        const current = problemOf(err)?.current as CatalogItem | undefined;
        if (current) {
          // Đóng rồi mở lại form để nạp bản mới nhất
          this.closeForm();
          setTimeout(() => this.openEdit(current));
        }
        this.toast.error('Quán vừa được sửa ở nơi khác. Đã tải bản mới nhất, hãy kiểm tra rồi lưu lại.');
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
      await this.catalog.remove(target.id);
      this.toast.success(`Đã xoá "${target.name}" khỏi Khám phá quán.`);
      await this.reload();
    } catch {
      // errorInterceptor đã hiện thông báo
    }
  }

  private markInMyPlace(id: string): void {
    this.items.update((list) => list.map((i) => (i.id === id ? { ...i, inMyPlace: true } : i)));
  }
}
