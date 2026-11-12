import { Component, computed, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PlaceService } from '../../core/services/place.service';
import { PlaceLinkService } from '../../core/services/place-link.service';
import { ToastService } from '../../core/services/toast.service';
import { Place, placePriceText, PlaceType } from '../../core/models/place.model';
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
import { SPOT_CATEGORIES, spotCategory, SpotItem, spotPriceText } from '../../core/models/spot.model';
import { StopKind } from '../../core/models/plan.model';
import { SpotDetailDialogComponent } from '../spots/spot-detail-dialog.component';
import { AddToPlanDialogComponent } from '../plans/add-to-plan-dialog.component';
import { AutoplanDialogComponent } from '../plans/autoplan-dialog.component';
import {
  ChoiceOption,
  CUISINE_OPTIONS,
  EMPTY_PLACE_FILTERS,
  isOpenAt,
  nowHHmm,
  PlaceFilters,
  placeFilterChips,
  placeFilterCount,
  placeMatches,
  priceInRange,
  removePlaceFilter,
  STAR_OPTIONS,
  toggleIn,
} from '../../core/models/filters.model';
import {
  ActiveFiltersComponent,
  ChoiceChipsComponent,
  FilterButtonComponent,
  FilterGroupComponent,
  FilterSheetComponent,
  FilterSwitchComponent,
  PriceRangeInputComponent,
} from '../../shared/ui/filter-sheet.component';
import { VibeTagsComponent } from '../../shared/ui/vibe-tags.component';
import { DEFAULT_BANNER, DEFAULT_BANNER_CREDIT, DEFAULT_BANNER_SRCSET, PageBannerComponent } from '../../shared/ui/page-banner.component';
import { ratingText } from '../../core/models/review.model';
import { listPager, PagerComponent } from '../../shared/ui/pager.component';

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
  imports: [FilterSheetComponent, FilterGroupComponent, ChoiceChipsComponent, FilterSwitchComponent, PriceRangeInputComponent, ActiveFiltersComponent, FilterButtonComponent, PageBannerComponent, AutoplanDialogComponent, VibeTagsComponent, AddToPlanDialogComponent, SpotDetailDialogComponent, PhotoCarouselComponent, FitRowDirective, RouterLink, PlaceDetailComponent, EmptyStateComponent, ConfirmDialogComponent, IconComponent, PagerComponent],
  templateUrl: './place-list.component.html',
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

  protected readonly sortOptions: { key: SortKey; label: string }[] = [
    { key: 'rating', label: 'Đánh giá cao' },
    { key: 'name', label: 'Tên A→Z' },
    { key: 'price', label: 'Giá tăng dần' },
    { key: 'distance', label: 'Gần tôi nhất' },
  ];

  protected readonly search = signal('');
  /** Bộ lọc chi tiết (bảng "Bộ lọc"), lọc ngay trên dữ liệu đã tải */
  protected readonly filters = signal<PlaceFilters>(EMPTY_PLACE_FILTERS);
  protected readonly filterOpen = signal(false);
  protected readonly filterChips = computed(() => placeFilterChips(this.filters()));
  protected readonly filterCount = computed(() => placeFilterCount(this.filters()));
  protected readonly starOptions = STAR_OPTIONS;
  protected readonly cuisineOptions = CUISINE_OPTIONS;
  protected readonly toggleIn = toggleIn;
  /** "Gần tôi nhất" chỉ có khi đã lấy vị trí */
  protected readonly sortChoices = computed<ChoiceOption[]>(() =>
    this.sortOptions.filter((o) => o.key !== 'distance' || this.userLocation()).map((o) => ({ value: o.key, label: o.label })),
  );

  protected setFilter(patch: Partial<PlaceFilters>): void {
    this.filters.update((f) => ({ ...f, ...patch }));
  }

  protected removeFilter(key: string): void {
    this.filters.set(removePlaceFilter(this.filters(), key));
  }

  protected clearFilters(): void {
    this.filters.set(EMPTY_PLACE_FILTERS);
  }

  /** Chọn loại món ở "Tất cả": chuyển sang Quán ăn */
  protected pickCuisine(cuisine: string): void {
    const cuisines = toggleIn(this.filters().cuisines, cuisine);
    if (cuisines.length && this.type() !== 'restaurant') this.pickType('restaurant');
    this.setFilter({ cuisines });
  }
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
  protected readonly planTarget = signal<{ kind: StopKind; refId: string; name: string; district: string | null } | null>(null);
  protected readonly autoplanOpen = signal(false);
  protected readonly rating = ratingText;
  protected readonly spotPrice = spotPriceText;

  /** Ảnh nền banner: ảnh nơi đầu tiên đã lưu; chưa lưu gì (hoặc đang tải) thì Hồ Gươm đêm */
  protected readonly defaultBanner = DEFAULT_BANNER;
  protected readonly defaultCredit = DEFAULT_BANNER_CREDIT;
  protected readonly defaultSrcset = DEFAULT_BANNER_SRCSET;
  protected readonly bannerImage = computed(() => {
    if (!this.placeService.loaded()) return DEFAULT_BANNER;
    return [...this.all(), ...this.savedSpots()].find((x) => x.imageUrl)?.imageUrl || DEFAULT_BANNER;
  });
  /** Tối đa 3 ảnh đã lưu (xen kẽ quán / chỗ chơi) xếp kiểu polaroid bên phải banner */
  protected readonly polaroids = computed(() => {
    const places = this.all().map((p) => p.imageUrl);
    const spots = this.savedSpots().map((s) => s.imageUrl);
    const mixed = [places[0], spots[0], places[1], spots[1], places[2], spots[2]];
    return mixed.filter((url): url is string => !!url).slice(0, 3);
  });
  protected readonly polaroidPos = ['left-0 top-5 -rotate-[8deg]', 'left-[74px] top-0 z-10 rotate-[3deg]', 'left-[148px] top-6 rotate-[10deg]'];
  protected readonly tagline = computed(() => {
    const n = this.all().length + this.savedSpots().length;
    return n ? `${n} điểm hẹn bạn đã lưu. Chọn một nơi cho buổi hẹn tới.` : 'Lưu quán và chỗ chơi ưng ý để chọn nhanh cho buổi hẹn tới.';
  });

  /** Tiêu đề nhóm quán theo chip loại đang chọn */
  protected placeTitle(): string {
    const t = this.type();
    return t && t !== 'spot' ? `${this.typeLabels[t]} đã lưu` : 'Quán đã lưu';
  }

  protected readonly hasAny = computed(() => this.all().length + this.savedSpots().length > 0);

  /** Quán hợp từ khoá và khoảng giá (chưa lọc loại): số trên chip đếm từ đây */
  private readonly matching = computed(() => {
    const keyword = this.search().trim().toLowerCase();
    const f = this.filters();
    const now = nowHHmm();
    return this.all().filter((p) => {
      if (!placeMatches(p, f, now)) return false;
      if (!keyword) return true;
      return [p.name, p.address, p.note, p.cuisine ?? ''].join(' ').toLowerCase().includes(keyword);
    });
  });

  /** Chỗ chơi đã lưu hợp từ khoá và khoảng giá */
  private readonly spotMatching = computed(() => {
    const keyword = this.search().trim().toLowerCase();
    const f = this.filters();
    const now = nowHHmm();
    return this.savedSpots().filter((s) => {
      // Giá: theo giá vé; số sao không áp dụng cho chỗ chơi; chọn loại món thì chỉ còn quán ăn
      if (!priceInRange(s.priceFrom, s.priceTo, f.priceMin, f.priceMax)) return false;
      if (f.cuisines.length || f.wifi || f.parking) return false;
      if (f.openNow && !isOpenAt(s.openTime, s.closeTime, now)) return false;
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

    return rows.sort((a, b) => {
      switch (this.sortKey()) {
        case 'name':
          return a.place.name.localeCompare(b.place.name, 'vi');
        case 'price':
          // Giá thấp → cao; quán chưa nhập giá xuống cuối
          return (a.place.priceFrom ?? Infinity) - (b.place.priceFrom ?? Infinity);
        case 'distance':
          return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
        default:
          return b.place.rating - a.place.rating;
      }
    });
  });

  /** Trang đang xem (?trang=), mỗi trang 20 mục: quán trước, chỗ chơi đã lưu nối sau */
  protected readonly pager = listPager('danh-sach');
  protected readonly pagePlaces = computed(() => this.pager.slice(this.visible()));
  protected readonly pageSpots = computed(() => {
    const places = this.visible().length;
    const from = Math.max(0, this.pager.offset() - places);
    const to = Math.max(0, this.pager.offset() + this.pager.size - places);
    return this.visibleSpots().slice(from, to);
  });

  constructor() {
    // Đổi từ khoá, bộ lọc, loại hay cách xếp: về trang 1 (lần chạy đầu là trạng thái mở trang, giữ ?trang=)
    let first = true;
    effect(() => {
      this.search();
      this.filters();
      this.type();
      this.sortKey();
      if (first) {
        first = false;
        return;
      }
      untracked(() => this.pager.reset());
    });
    // Danh sách ngắn lại (bỏ lưu mục cuối của trang cuối): lùi về trang cuối; chờ dữ liệu tải xong mới tính
    effect(() => {
      if (!this.placeService.loaded()) return;
      const total = this.visible().length + this.visibleSpots().length;
      untracked(() => this.pager.clamp(total));
    });
  }

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

  /** Chip trên thẻ: "80k–150k" hoặc tên nhóm giá */
  protected priceText(place: Place): string {
    return placePriceText(place, false);
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
  protected readonly spotShort = (s: SpotItem) => SPOT_CATEGORIES.find((c) => c.value === s.category)?.short ?? spotCategory(s.category).label;

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
