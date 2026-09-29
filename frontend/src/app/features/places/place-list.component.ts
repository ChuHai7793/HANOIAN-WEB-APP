import { Component, computed, inject, input, signal } from '@angular/core';
import { PlaceService } from '../../core/services/place.service';
import { PlaceLinkService } from '../../core/services/place-link.service';
import { Place, PriceRange, PRICE_RANGES, priceLabel } from '../../core/models/place.model';
import { PlaceTypeConfig } from './place.config';
import { PlaceFormComponent } from './place-form.component';
import { PlaceDetailComponent } from './place-detail.component';
import { RatingStarsComponent } from '../../shared/ui/rating-stars.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog.component';
import { directionsUrl } from '../../core/utils/gmap-url';
import { formatDistance, haversineKm, LatLng } from '../../core/utils/geo';
import { AuthService } from '../../core/auth/auth.service';

type SortKey = 'rating' | 'name' | 'distance' | 'price';

interface PlaceRow {
  place: Place;
  distanceKm: number | null;
}

@Component({
  selector: 'app-place-list',
  imports: [
    PlaceFormComponent,
    PlaceDetailComponent,
    RatingStarsComponent,
    EmptyStateComponent,
    ConfirmDialogComponent,
  ],
  template: `
    <!-- Vùng cố định: tiêu đề + bộ lọc. top-16 để nằm dưới thanh header mobile. -->
    <div
      class="sticky top-16 z-20 bg-slate-50 px-4 pb-4 pt-4 sm:px-6 sm:pt-6 lg:top-0 lg:px-8 lg:pt-8"
    >
      <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <span>{{ config().icon }}</span> {{ config().title }}
        </h1>
        <p class="mt-1 text-sm text-slate-500">{{ config().subtitle }}</p>
      </div>
      @if (canEdit()) {
        <button
          type="button"
          class="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          (click)="openCreate()"
        >
          + {{ config().addLabel }}
        </button>
      }
    </div>

      <!-- Bộ lọc -->
      <div class="rounded-xl border border-slate-200 bg-white p-4">
      <div class="grid gap-3 sm:grid-cols-3">
        <div class="relative sm:col-span-2">
          <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          <input
            type="search"
            [value]="search()"
            (input)="search.set($any($event.target).value)"
            [placeholder]="config().searchPlaceholder"
            class="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>

        <select
          [value]="price()"
          (change)="price.set($any($event.target).value)"
          class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
        >
          <option value="">Mọi khoảng giá</option>
          @for (p of priceRanges; track p.value) {
            <option [value]="p.value">{{ p.label }} ({{ p.hint }})</option>
          }
        </select>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
        <span class="text-xs font-medium text-slate-500">Sắp xếp:</span>
        @for (opt of sortOptions; track opt.key) {
          <button
            type="button"
            class="rounded-full px-3 py-1 text-xs font-medium transition"
            [class]="
              sortKey() === opt.key
                ? 'bg-brand-100 text-brand-700'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            "
            [disabled]="opt.key === 'distance' && !userLocation()"
            (click)="sortKey.set(opt.key)"
          >
            {{ opt.label }}
          </button>
        }

        <button
          type="button"
          class="ml-auto rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          (click)="locateMe()"
        >
          @if (locating()) {
            Đang lấy vị trí…
          } @else if (userLocation()) {
            📍 Đã có vị trí của bạn
          } @else {
            📍 Tính khoảng cách từ tôi
          }
        </button>
      </div>

        @if (locationError()) {
          <p class="mt-2 text-xs text-amber-700">{{ locationError() }}</p>
        }
      </div>
    </div>

    <!-- Vùng cuộn: chỉ danh sách quán -->
    <div class="px-4 pb-8 sm:px-6 lg:px-8">
      @if (visible().length === 0) {
      <app-empty-state
        [icon]="config().icon"
        [title]="hasAny() ? 'Không tìm thấy quán phù hợp' : config().emptyTitle"
        [description]="hasAny() ? 'Thử xoá bớt bộ lọc hoặc từ khoá tìm kiếm.' : config().emptyDescription"
      >
        @if (!hasAny() && canEdit()) {
          <button
            type="button"
            class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
            (click)="openCreate()"
          >
            {{ config().addLabel }}
          </button>
        }
      </app-empty-state>
    } @else {
      <p class="mb-3 text-sm text-slate-500">
        Hiển thị <strong class="text-slate-700">{{ visible().length }}</strong> /
        {{ all().length }} quán
      </p>

      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        @for (item of visible(); track item.place.id) {
          <article
            class="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-brand-300 hover:shadow-md"
          >
            <div class="relative h-40 bg-slate-100">
              <button
                type="button"
                class="block h-full w-full cursor-pointer"
                (click)="detailing.set(item)"
                [attr.aria-label]="'Xem chi tiết ' + item.place.name"
              >
                @if (item.place.imageUrl) {
                  <!-- Bản mờ phóng to làm nền, ảnh thật đặt trên và hiện đầy đủ không bị cắt -->
                  <img
                    [src]="item.place.imageUrl"
                    alt=""
                    aria-hidden="true"
                    class="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-lg"
                    loading="lazy"
                  />
                  <img
                    [src]="item.place.imageUrl"
                    [alt]="item.place.name"
                    class="relative h-full w-full object-contain transition group-hover:brightness-90"
                    loading="lazy"
                  />
                } @else {
                  <div class="flex h-full items-center justify-center text-4xl opacity-30">
                    {{ config().icon }}
                  </div>
                }
                <span
                  class="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-900/40 text-sm font-semibold text-white opacity-0 transition group-hover:opacity-100"
                >
                  Xem chi tiết
                </span>
              </button>
              <span
                class="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm"
              >
                {{ priceText(item.place.priceRange) }}
              </span>
              @if (item.distanceKm !== null) {
                <span
                  class="absolute right-3 top-3 rounded-full bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
                >
                  {{ distanceText(item.distanceKm) }}
                </span>
              }
            </div>

            <div class="flex flex-1 flex-col p-4">
              <div class="flex items-start justify-between gap-2">
                <h3 class="font-semibold leading-snug text-slate-900">{{ item.place.name }}</h3>
              </div>

              <div class="mt-1.5">
                <app-rating-stars [value]="item.place.rating" />
              </div>

              <p class="mt-2 line-clamp-2 text-sm text-slate-500">
                {{ item.place.address }}
              </p>

              <div class="mt-3 flex flex-wrap gap-1.5">
                <span class="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  🕐 {{ item.place.openTime }}–{{ item.place.closeTime }}
                </span>
                @if (item.place.cuisine) {
                  <span class="rounded-md bg-orange-50 px-2 py-0.5 text-xs text-orange-700">
                    {{ item.place.cuisine }}
                  </span>
                }
                @if (item.place.hasWifi) {
                  <span class="rounded-md bg-sky-50 px-2 py-0.5 text-xs text-sky-700">📶 Wifi</span>
                }
                @if (item.place.hasParking) {
                  <span class="rounded-md bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                    🛵 Đậu xe
                  </span>
                }
              </div>

              @if (item.place.note) {
                <p class="mt-3 line-clamp-2 text-xs italic text-slate-400">"{{ item.place.note }}"</p>
              }

              <div class="mt-auto flex items-center gap-2 pt-4">
                <a
                  [href]="directions(item.place)"
                  target="_blank"
                  rel="noopener"
                  class="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-center text-xs font-semibold text-white transition hover:bg-slate-700"
                >
                  🧭 Chỉ đường
                </a>
                <button
                  type="button"
                  class="rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-600 transition hover:bg-slate-50"
                  (click)="detailing.set(item)"
                  title="Xem chi tiết"
                >
                  👁️
                </button>
                @if (canEdit()) {
                  <button
                    type="button"
                    class="rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-600 transition hover:bg-slate-50"
                    (click)="openEdit(item.place)"
                    title="Sửa"
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    class="rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-rose-600 transition hover:bg-rose-50"
                    (click)="pendingDelete.set(item.place)"
                    title="Xoá"
                  >
                    🗑️
                  </button>
                }
              </div>
            </div>
          </article>
        }
        </div>
      }
    </div>

    <!-- Form thêm/sửa -->
    @if (formOpen()) {
      <app-place-form
        [config]="config()"
        [place]="editing()"
        (save)="handleSave($event)"
        (cancel)="closeForm()"
      />
    }

    <!-- Chi tiết quán -->
    @if (detailing(); as row) {
      <app-place-detail
        [place]="row.place"
        [distanceKm]="row.distanceKm"
        [editable]="canEdit()"
        (edit)="editFromDetail(row.place)"
        (dismiss)="detailing.set(null)"
      />
    }

    <!-- Xác nhận xoá -->
    @if (pendingDelete(); as target) {
      <app-confirm-dialog
        title="Xoá quán này?"
        [message]="'Xoá &quot;' + target.name + '&quot; sẽ gỡ luôn quán khỏi mọi người yêu đã gắn. Hành động này không hoàn tác được.'"
        (confirm)="confirmDelete()"
        (cancel)="pendingDelete.set(null)"
      />
    }
  `,
})
export class PlaceListComponent {
  private readonly placeService = inject(PlaceService);
  private readonly linkService = inject(PlaceLinkService);
  /** Guest chỉ xem: ẩn nút thêm/sửa/xoá (server cũng chặn request ghi). */
  protected readonly canEdit = inject(AuthService).canEdit;

  readonly config = input.required<PlaceTypeConfig>();

  protected readonly priceRanges = PRICE_RANGES;
  protected readonly sortOptions: { key: SortKey; label: string }[] = [
    { key: 'rating', label: 'Đánh giá cao' },
    { key: 'name', label: 'Tên A→Z' },
    { key: 'price', label: 'Giá tăng dần' },
    { key: 'distance', label: 'Gần tôi nhất' },
  ];

  protected readonly search = signal('');
  protected readonly price = signal('');
  protected readonly sortKey = signal<SortKey>('rating');

  protected readonly userLocation = signal<LatLng | null>(null);
  protected readonly locating = signal(false);
  protected readonly locationError = signal('');

  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Place | null>(null);
  protected readonly detailing = signal<PlaceRow | null>(null);
  protected readonly pendingDelete = signal<Place | null>(null);
  protected readonly saving = signal(false);

  protected readonly all = computed(() => this.placeService.byType(this.config().type)());
  protected readonly hasAny = computed(() => this.all().length > 0);

  protected readonly visible = computed<PlaceRow[]>(() => {
    const keyword = this.search().trim().toLowerCase();
    const priceFilter = this.price();
    const origin = this.userLocation();

    const rows = this.all()
      .filter((p) => {
        if (priceFilter && p.priceRange !== priceFilter) return false;
        if (!keyword) return true;
        return [p.name, p.address, p.note, p.cuisine ?? '']
          .join(' ')
          .toLowerCase()
          .includes(keyword);
      })
      .map((place) => ({
        place,
        distanceKm:
          origin && place.lat !== null && place.lng !== null
            ? haversineKm(origin, { lat: place.lat, lng: place.lng })
            : null,
      }));

    const priceOrder: PriceRange[] = ['cheap', 'medium', 'high', 'luxury'];
    return rows.sort((a, b) => {
      switch (this.sortKey()) {
        case 'name':
          return a.place.name.localeCompare(b.place.name, 'vi');
        case 'price':
          return (
            priceOrder.indexOf(a.place.priceRange) - priceOrder.indexOf(b.place.priceRange)
          );
        case 'distance':
          return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
        default:
          return b.place.rating - a.place.rating;
      }
    });
  });

  protected priceText(value: PriceRange): string {
    return priceLabel(value);
  }

  protected distanceText(km: number): string {
    return formatDistance(km);
  }

  protected directions(p: Place): string {
    return directionsUrl(p.lat, p.lng, `${p.name} ${p.address}`);
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.formOpen.set(true);
  }

  protected openEdit(place: Place): void {
    this.editing.set(place);
    this.formOpen.set(true);
  }

  /** Từ modal chi tiết bấm Sửa: đóng chi tiết rồi mở form */
  protected editFromDetail(place: Place): void {
    this.detailing.set(null);
    this.openEdit(place);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.editing.set(null);
  }

  /** Lỗi thì giữ form để người dùng sửa/thử lại (toast do errorInterceptor hiện) */
  protected async handleSave(place: Place): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    const existing = this.editing();
    const { id, ...data } = place;
    try {
      if (existing) {
        await this.placeService.update(existing.id, data);
      } else {
        await this.placeService.create(data);
      }
      this.closeForm();
    } catch {
      // giữ form mở
    } finally {
      this.saving.set(false);
    }
  }

  protected async confirmDelete(): Promise<void> {
    const target = this.pendingDelete();
    if (!target) return;
    this.pendingDelete.set(null);
    try {
      await this.placeService.remove(target.id);
      // Server đã xoá link theo (ON DELETE CASCADE)
      this.linkService.dropByPlace(target.id);
    } catch {
      // store đã hoàn tác, toast đã hiện
    }
  }

  protected locateMe(): void {
    if (!navigator.geolocation) {
      this.locationError.set('Trình duyệt không hỗ trợ định vị.');
      return;
    }
    this.locating.set(true);
    this.locationError.set('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.userLocation.set({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        this.sortKey.set('distance');
        this.locating.set(false);
      },
      () => {
        this.locationError.set(
          'Không lấy được vị trí. Hãy cho phép quyền truy cập vị trí trong trình duyệt.',
        );
        this.locating.set(false);
      },
      { timeout: 10_000 },
    );
  }
}
