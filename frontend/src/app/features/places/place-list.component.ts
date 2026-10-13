import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PlaceService } from '../../core/services/place.service';
import { PlaceLinkService } from '../../core/services/place-link.service';
import { ToastService } from '../../core/services/toast.service';
import { Place, PlaceType, PriceRange, PRICE_RANGES, priceLabel } from '../../core/models/place.model';
import { PlaceDetailComponent } from './place-detail.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog.component';
import { directionsUrl } from '../../core/utils/gmap-url';
import { IconComponent, IconName } from '../../shared/ui/icon.component';
import { formatDistance, haversineKm, LatLng } from '../../core/utils/geo';
import { FitRowDirective } from '../../shared/ui/fit-row.directive';
import { PhotoCarouselComponent } from '../../shared/ui/photo-carousel.component';
import { photosOf } from '../../core/models/place.model';
import { SavedSpotService } from '../../core/services/saved-spot.service';
import { spotCategory, SpotItem } from '../../core/models/spot.model';
import { StopKind } from '../../core/models/plan.model';
import { SpotDetailDialogComponent } from '../spots/spot-detail-dialog.component';
import { AddToPlanDialogComponent } from '../plans/add-to-plan-dialog.component';

type SortKey = 'rating' | 'name' | 'distance' | 'price';

/** Chip lọc: 3 loại quán và chỗ chơi đã lưu ('spot') */
type MyPlaceFilter = PlaceType | '' | 'spot';
const TYPE_FILTERS: { value: MyPlaceFilter; label: string; icon: IconName }[] = [
  { value: '', label: 'Tất cả', icon: 'compass' },
  { value: 'cafe', label: 'Cafe', icon: 'cup' },
  { value: 'bar', label: 'Bar', icon: 'cocktail' },
  { value: 'restaurant', label: 'Quán ăn', icon: 'utensils' },
  { value: 'spot', label: 'Chỗ chơi', icon: 'gate' },
];
/** Khoảng giá của quán ↔ giá vé chỗ chơi (VNĐ / người), cho lọc và sắp xếp chung */
const PRICE_LIMITS: Record<PriceRange, [number, number]> = {
  cheap: [0, 50_000],
  medium: [50_000, 150_000],
  high: [150_000, 400_000],
  luxury: [400_000, Infinity],
};
const PRICE_ESTIMATE: Record<PriceRange, number> = { cheap: 40_000, medium: 100_000, high: 275_000, luxury: 500_000 };

interface SpotRow {
  spot: SpotItem;
  distanceKm: number | null;
}
const TYPE_LABELS: Record<PlaceType, string> = { cafe: 'Cafe', bar: 'Bar', restaurant: 'Quán ăn' };
const TYPE_ICONS: Record<PlaceType, IconName> = { cafe: 'cup', bar: 'cocktail', restaurant: 'utensils' };
const PLACE_TYPES: PlaceType[] = ['cafe', 'bar', 'restaurant'];

interface PlaceRow {
  place: Place;
  distanceKm: number | null;
}

@Component({
  selector: 'app-place-list',
  imports: [AddToPlanDialogComponent, SpotDetailDialogComponent, PhotoCarouselComponent, FitRowDirective, RouterLink, PlaceDetailComponent, EmptyStateComponent, ConfirmDialogComponent, IconComponent],
  template: `
    <div class="flex flex-col gap-3 px-4 pb-10 pt-4 sm:px-6 lg:px-8 lg:pt-5">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col gap-1.5">
          <h1 class="text-xl font-extrabold tracking-tight text-slate-900">My place</h1>
          <p class="hidden text-[13px] text-slate-500 sm:block">Quán và chỗ chơi bạn đã lưu từ Khám phá quán, Tìm chỗ chơi.</p>
        </div>
        <a
          routerLink="/explore"
          class="flex min-h-9 items-center gap-2 rounded-xl border border-brand-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-brand-50"
        >
          <app-icon name="compass" [size]="18" />
          Khám phá quán
        </a>
      </header>

      <div class="flex flex-wrap items-center gap-2">
        <label class="flex min-h-9 max-w-[420px] flex-[1_1_280px] items-center gap-2.5 rounded-xl border border-brand-200 bg-white px-3.5 text-slate-500">
          <app-icon name="search" [size]="18" />
          <span class="sr-only">Tìm quán</span>
          <input
            type="search"
            [value]="search()"
            (input)="search.set($any($event.target).value)"
            class="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            placeholder="Tìm theo tên, địa chỉ, ghi chú…"
          />
        </label>
        <label class="flex min-h-9 items-center rounded-xl border border-brand-200 bg-white px-3 text-sm text-slate-700">
          <span class="sr-only">Khoảng giá</span>
          <select
            [value]="price()"
            (change)="price.set($any($event.target).value)"
            class="cursor-pointer bg-transparent text-sm text-slate-900 outline-none"
          >
            <option value="">Mọi khoảng giá</option>
            @for (p of priceRanges; track p.value) {
              <option [value]="p.value">{{ p.label }} ({{ p.hint }})</option>
            }
          </select>
        </label>
        <div role="group" aria-label="Loại quán" class="flex max-sm:-mx-4 max-sm:overflow-x-auto max-sm:px-4 max-sm:[scrollbar-width:none] *:shrink-0 *:whitespace-nowrap sm:flex-wrap gap-2">
          @for (t of typeFilters; track t.value) {
            <button
              type="button"
              [attr.aria-pressed]="type() === t.value"
              class="min-h-9 rounded-full border px-3 text-[13px] transition"
              [class]="type() === t.value
                ? 'border-brand-600 bg-brand-600 font-semibold text-white'
                : 'border-brand-200 bg-white font-medium text-slate-700 hover:bg-brand-50'"
              (click)="pickType(t.value)"
            >
              <span class="inline-flex items-center gap-1.5"><app-icon [name]="t.icon" [size]="15" />{{ t.label }} · {{ counts()[t.value || 'all'] }}</span>
            </button>
          }
        </div>
      </div>

      <div class="-mt-2 flex flex-wrap items-center gap-2">
        <span class="text-[13px] text-slate-500">Sắp xếp:</span>
        @for (opt of sortOptions; track opt.key) {
          <button
            type="button"
            [attr.aria-pressed]="sortKey() === opt.key"
            class="min-h-9 rounded-full border px-3.5 text-[13px] transition disabled:opacity-40"
            [class]="sortKey() === opt.key
              ? 'border-brand-200 bg-brand-100 font-semibold text-brand-800'
              : 'border-transparent text-slate-600 hover:bg-brand-50'"
            [disabled]="opt.key === 'distance' && !userLocation()"
            (click)="sortKey.set(opt.key)"
          >
            {{ opt.label }}
          </button>
        }
        <button
          type="button"
          class="ml-auto flex min-h-9 items-center gap-1.5 rounded-[10px] border border-brand-200 bg-white px-3 text-[13px] font-medium text-slate-700 transition hover:bg-brand-50"
          (click)="locateMe()"
        >
          <span class="text-brand-600"><app-icon name="locate" [size]="15" /></span>
          @if (locating()) {
            Đang lấy vị trí…
          } @else if (userLocation()) {
            Đã có vị trí của bạn
          } @else {
            Tính khoảng cách từ tôi
          }
        </button>
      </div>
      @if (locationError()) {
        <p class="-mt-3 text-xs text-amber-700">{{ locationError() }}</p>
      }

      @if (visible().length === 0 && visibleSpots().length === 0) {
        <app-empty-state
          [icon]="emptyIcon()"
          [title]="hasAny() ? 'Không tìm thấy mục phù hợp' : 'My place còn trống'"
          [description]="hasAny() ? 'Thử xoá bớt bộ lọc hoặc từ khoá tìm kiếm.' : 'Vào Khám phá quán hoặc Tìm chỗ chơi, bấm &quot;Lưu&quot; để lưu vào đây.'"
        >
          @if (!hasAny()) {
            <a
              routerLink="/explore"
              class="flex min-h-9 items-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              <app-icon name="compass" [size]="18" />
              Vào Khám phá quán
            </a>
          }
        </app-empty-state>
      } @else {
        <span class="text-[13px] text-slate-500">{{ visible().length + visibleSpots().length }} / {{ all().length + savedSpots().length }} mục</span>
        <!-- Hàng thẻ đầu vừa khít màn hình, hàng sau cuộn mới thấy -->
        <div appFitRow class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          @for (item of visible(); track item.place.id) {
            <article
              class="flex h-[var(--row-h,420px)] cursor-pointer flex-col overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(48,30,110,0.04),0_8px_24px_rgba(48,30,110,0.05)] transition hover:border-brand-300"
              (click)="detailing.set(item)"
            >
              <div class="group relative flex min-h-0 flex-[0_1_75%] items-center justify-center overflow-hidden bg-[#EFEAFC] text-brand-500">
                @if (item.place.imageUrl) {
                  <app-photo-carousel class="h-full w-full" [photos]="photosOf(item.place)" [alt]="item.place.name" />
                } @else {
                  <app-icon [name]="typeIcons[item.place.type]" [size]="40" [stroke]="1.5" />
                }
                <span class="absolute left-3 top-3 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-brand-800">
                  {{ typeLabels[item.place.type] }}
                </span>
                @if (item.distanceKm !== null) {
                  <span class="absolute right-3 top-3 rounded-full bg-slate-900/70 px-2.5 py-1 text-xs font-medium text-white">
                    {{ distanceText(item.distanceKm) }}
                  </span>
                }
              </div>
              <div class="flex flex-[1_0_25%] flex-col justify-between gap-2 px-3.5 pb-3 pt-2.5">
                <div class="flex min-w-0 flex-col gap-1">
                  <h2 class="truncate text-base font-bold tracking-tight text-slate-900" [title]="item.place.name">{{ item.place.name }}</h2>
                  <span class="truncate text-[13px] text-slate-500">{{ item.place.address || 'Chưa có địa chỉ' }}</span>
                </div>
                <div class="grid grid-cols-3 gap-1.5" (click)="$event.stopPropagation()">
                  <a [href]="directions(item.place)" target="_blank" rel="noopener" class="flex min-h-9 items-center justify-center gap-1 whitespace-nowrap rounded-[10px] border border-brand-200 px-1.5 text-xs font-medium text-slate-700 hover:bg-brand-50"><app-icon name="navigate" [size]="14" />Chỉ đường</a>
                  <button type="button" class="flex min-h-9 items-center justify-center gap-1 whitespace-nowrap rounded-[10px] border border-brand-200 px-1.5 text-xs font-medium text-slate-700 hover:bg-brand-50" (click)="detailing.set(item)"><app-icon name="eye" [size]="14" />Chi tiết</button>
                  <button type="button" class="flex min-h-9 items-center justify-center gap-1 whitespace-nowrap rounded-[10px] border border-brand-200 px-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50" title="Bỏ khỏi My place" (click)="pendingRemove.set(item.place)">
                    <app-icon name="trash" [size]="14" />Bỏ
                  </button>
                </div>
              </div>
            </article>
          }
          <!-- Chỗ chơi đã lưu (sau các quán) -->
          @for (row of visibleSpots(); track row.spot.id) {
            <article
              class="flex h-[var(--row-h,420px)] cursor-pointer flex-col overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(48,30,110,0.04),0_8px_24px_rgba(48,30,110,0.05)] transition hover:border-brand-300"
              (click)="spotDetail.set(row.spot)"
            >
              <div class="relative flex min-h-0 flex-[0_1_75%] items-center justify-center overflow-hidden bg-[#EFEAFC] text-brand-500">
                @if (row.spot.imageUrl) {
                  <app-photo-carousel class="h-full w-full" [photos]="photosOf(row.spot)" [alt]="row.spot.name" />
                } @else {
                  <app-icon [name]="spotIcon(row.spot)" [size]="40" [stroke]="1.5" />
                }
                <span class="absolute left-3 top-3 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-brand-800">{{ spotLabel(row.spot) }}</span>
                @if (row.distanceKm !== null) {
                  <span class="absolute right-3 top-3 rounded-full bg-slate-900/70 px-2.5 py-1 text-xs font-medium text-white">{{ distanceText(row.distanceKm) }}</span>
                }
              </div>
              <div class="flex flex-[1_0_25%] flex-col justify-between gap-2 px-3.5 pb-3 pt-2.5">
                <div class="flex min-w-0 flex-col gap-1">
                  <h2 class="truncate text-base font-bold tracking-tight text-slate-900" [title]="row.spot.name">{{ row.spot.name }}</h2>
                  <span class="truncate text-[13px] text-slate-500">{{ row.spot.address || 'Chưa có địa chỉ' }}</span>
                </div>
                <div class="grid grid-cols-3 gap-1.5" (click)="$event.stopPropagation()">
                  <a [href]="spotDirections(row.spot)" target="_blank" rel="noopener" class="flex min-h-9 items-center justify-center gap-1 whitespace-nowrap rounded-[10px] border border-brand-200 px-1.5 text-xs font-medium text-slate-700 hover:bg-brand-50"><app-icon name="navigate" [size]="14" />Chỉ đường</a>
                  <button type="button" class="flex min-h-9 items-center justify-center gap-1 whitespace-nowrap rounded-[10px] border border-brand-200 px-1.5 text-xs font-medium text-slate-700 hover:bg-brand-50" (click)="spotDetail.set(row.spot)"><app-icon name="eye" [size]="14" />Chi tiết</button>
                  <button type="button" class="flex min-h-9 items-center justify-center gap-1 whitespace-nowrap rounded-[10px] border border-brand-200 px-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50" title="Bỏ khỏi My place" (click)="pendingRemoveSpot.set(row.spot)">
                    <app-icon name="trash" [size]="14" />Bỏ
                  </button>
                </div>
              </div>
            </article>
          }
        </div>
      }
    </div>

    @if (spotDetail(); as d) {
      <app-spot-detail-dialog
        [spot]="d"
        [saved]="true"
        (closed)="spotDetail.set(null)"
        (plan)="spotDetail.set(null); planTarget.set({ kind: 'spot', refId: $event.id, name: $event.name, district: $event.district })"
      />
    }
    @if (planTarget(); as t) {
      <app-add-to-plan-dialog [kind]="t.kind" [refId]="t.refId" [name]="t.name" [district]="t.district" (closed)="planTarget.set(null)" />
    }
    @if (pendingRemoveSpot(); as target) {
      <app-confirm-dialog
        title="Bỏ khỏi My place?"
        [message]="'Bỏ &quot;' + target.name + '&quot; khỏi My place. Có thể lưu lại từ Tìm chỗ chơi.'"
        confirmLabel="Bỏ khỏi My place"
        (confirm)="confirmRemoveSpot()"
        (cancel)="pendingRemoveSpot.set(null)"
      />
    }

    <!-- Chi tiết quán -->
    @if (detailing(); as row) {
      <app-place-detail
        [place]="row.place"
        [distanceKm]="row.distanceKm"
        [editable]="false"
        (dismiss)="detailing.set(null)"
      />
    }

    <!-- Xác nhận bỏ khỏi My place -->
    @if (pendingRemove(); as target) {
      <app-confirm-dialog
        title="Bỏ khỏi My place?"
        [message]="'Bỏ &quot;' + target.name + '&quot; khỏi My place. Quán đã gắn với người yêu nào thì liên kết đó cũng bị gỡ. Có thể add lại từ Khám phá quán.'"
        confirmLabel="Bỏ khỏi My place"
        (confirm)="confirmRemove()"
        (cancel)="pendingRemove.set(null)"
      />
    }
  `,
})
export class PlaceListComponent implements OnInit {
  protected readonly photosOf = photosOf;
  /**
   * My place của người đang đăng nhập: mọi quán đã lưu, lọc theo loại bằng chip (Tất cả, Cafe, Bar, Quán
   * ăn) như Khám phá quán; loại đang chọn nằm trên URL (?type=cafe). Xem và "Bỏ khỏi My place"; quán được
   * thêm từ "Khám phá quán", không thêm, sửa ở đây.
   */
  private readonly placeService = inject(PlaceService);
  private readonly linkService = inject(PlaceLinkService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly typeFilters = TYPE_FILTERS;
  protected readonly typeLabels = TYPE_LABELS;
  protected readonly typeIcons = TYPE_ICONS;
  protected readonly type = signal<MyPlaceFilter>('');

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

  protected readonly detailing = signal<PlaceRow | null>(null);
  protected readonly pendingRemove = signal<Place | null>(null);

  protected readonly all = this.placeService.items;
  private readonly savedSpotService = inject(SavedSpotService);
  /** Chỗ chơi đã lưu */
  protected readonly savedSpots = this.savedSpotService.items;
  protected readonly spotDetail = signal<SpotItem | null>(null);
  protected readonly pendingRemoveSpot = signal<SpotItem | null>(null);
  protected readonly planTarget = signal<{ kind: StopKind; refId: string; name: string; district: string } | null>(null);
  protected readonly hasAny = computed(() => this.all().length + this.savedSpots().length > 0);

  /** Quán hợp từ khoá và khoảng giá (chưa lọc loại): số trên chip đếm từ đây */
  private readonly matching = computed(() => {
    const keyword = this.search().trim().toLowerCase();
    const priceFilter = this.price();
    return this.all().filter((p) => {
      if (priceFilter && p.priceRange !== priceFilter) return false;
      if (!keyword) return true;
      return [p.name, p.address, p.note, p.cuisine ?? ''].join(' ').toLowerCase().includes(keyword);
    });
  });

  /** Chỗ chơi đã lưu hợp từ khoá và khoảng giá */
  private readonly spotMatching = computed(() => {
    const keyword = this.search().trim().toLowerCase();
    const priceFilter = this.price() as PriceRange | '';
    return this.savedSpots().filter((s) => {
      if (priceFilter) {
        const [min, max] = PRICE_LIMITS[priceFilter];
        if (s.priceFrom < min || s.priceFrom >= max) return false;
      }
      if (!keyword) return true;
      return [s.name, s.address, s.description].join(' ').toLowerCase().includes(keyword);
    });
  });

  protected readonly visibleSpots = computed<SpotRow[]>(() => {
    const type = this.type();
    if (type && type !== 'spot') return [];
    const origin = this.userLocation();
    const rows = this.spotMatching().map((spot) => ({
      spot,
      distanceKm: origin && spot.lat !== null && spot.lng !== null ? haversineKm(origin, { lat: spot.lat, lng: spot.lng }) : null,
    }));
    return rows.sort((a, b) => {
      switch (this.sortKey()) {
        case 'price':
          return a.spot.priceFrom - b.spot.priceFrom;
        case 'distance':
          return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
        default:
          return a.spot.name.localeCompare(b.spot.name, 'vi');
      }
    });
  });

  protected readonly counts = computed(() => {
    const list = this.matching();
    const spots = this.spotMatching().length;
    const out: Record<'all' | Exclude<MyPlaceFilter, ''>, number> = { all: list.length + spots, cafe: 0, bar: 0, restaurant: 0, spot: spots };
    for (const p of list) out[p.type]++;
    return out;
  });

  protected readonly visible = computed<PlaceRow[]>(() => {
    const type = this.type();
    const origin = this.userLocation();

    const rows = this.matching()
      .filter((p) => !type || p.type === type)
      .filter(() => type !== 'spot')
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

  ngOnInit(): void {
    const t = this.route.snapshot.queryParamMap.get('type');
    this.type.set(PLACE_TYPES.includes(t as PlaceType) || t === 'spot' ? (t as MyPlaceFilter) : '');
  }

  /** Đổi loại và ghi lên URL (quay lại / chia sẻ link giữ đúng tab) */
  protected pickType(type: MyPlaceFilter): void {
    this.type.set(type);
    void this.router.navigate([], { queryParams: { type: type || null }, replaceUrl: true });
  }

  /** 4 → { on: '★★★★', off: '★' } */
  protected stars(rating: number): { on: string; off: string } {
    return { on: '★'.repeat(rating), off: '★'.repeat(5 - rating) };
  }

  protected priceText(value: PriceRange): string {
    return priceLabel(value);
  }

  protected distanceText(km: number): string {
    return formatDistance(km);
  }

  protected directions(p: Place): string {
    return directionsUrl(p.lat, p.lng, `${p.name} ${p.address}`);
  }

  protected emptyIcon(): IconName {
    const t = this.type();
    return t === 'spot' ? 'gate' : t ? this.typeIcons[t] : 'bookmark';
  }

  protected readonly spotIcon = (s: SpotItem) => spotCategory(s.category).icon;
  protected readonly spotLabel = (s: SpotItem) => spotCategory(s.category).label;

  protected spotDirections(s: SpotItem): string {
    return directionsUrl(s.lat, s.lng, `${s.name} ${s.address}`);
  }

  protected async confirmRemoveSpot(): Promise<void> {
    const target = this.pendingRemoveSpot();
    this.pendingRemoveSpot.set(null);
    if (!target) return;
    await this.savedSpotService.remove(target.id);
    this.toast.success(`Đã bỏ "${target.name}" khỏi My place.`);
  }

  protected async confirmRemove(): Promise<void> {
    const target = this.pendingRemove();
    if (!target) return;
    this.pendingRemove.set(null);
    try {
      await this.placeService.remove(target.id);
      // Server đã gỡ liên kết người yêu–quán theo (ON DELETE CASCADE)
      this.linkService.dropByPlace(target.id);
      this.toast.success(`Đã bỏ "${target.name}" khỏi My place.`);
    } catch {
      // store đã hoàn tác, toast lỗi do errorInterceptor hiện
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
