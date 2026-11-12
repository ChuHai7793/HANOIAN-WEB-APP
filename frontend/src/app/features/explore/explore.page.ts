import { Component, computed, inject, input, OnDestroy, OnInit, signal } from '@angular/core';
import { errorCode, problemOf } from '../../core/api/api';
import { SeoService } from '../../core/seo/seo.service';
import { AuthService } from '../../core/auth/auth.service';
import { CatalogItem, FeaturedItem, DistrictOption, MY_PLACE_GROUP, TypeCounts } from '../../core/models/catalog.model';
import { Place, placePriceDetail, placePriceText, PlaceType } from '../../core/models/place.model';
import { CatalogRequest, CatalogService } from '../../core/services/catalog.service';
import { PlaceService } from '../../core/services/place.service';
import { ToastService } from '../../core/services/toast.service';
import { directionsUrl, viewOnMapUrl } from '../../core/utils/gmap-url';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog.component';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  CUISINE_OPTIONS,
  EMPTY_PLACE_FILTERS,
  nowHHmm,
  PLACE_SORTS,
  PlaceFilters,
  placeFilterChips,
  placeFilterCount,
  placeFiltersFromParams,
  placeFiltersToParams,
  removePlaceFilter,
  STAR_OPTIONS,
  toggleIn,
  VIBE_OPTIONS,
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
import { IconComponent, IconName } from '../../shared/ui/icon.component';
import { PlaceFormComponent } from '../places/place-form.component';
import { BAR_CONFIG, CAFE_CONFIG, PlaceTypeConfig, RESTAURANT_CONFIG } from '../places/place.config';
import { VibeTagsComponent } from '../../shared/ui/vibe-tags.component';
import { AddToPlanDialogComponent } from '../plans/add-to-plan-dialog.component';
import { StopKind } from '../../core/models/plan.model';
import { FitRowDirective } from '../../shared/ui/fit-row.directive';
import { PhotoCarouselComponent } from '../../shared/ui/photo-carousel.component';
import { photosOf } from '../../core/models/place.model';
import { LoginGate } from '../../core/auth/login-gate.service';
import { AutoplanDialogComponent } from '../plans/autoplan-dialog.component';
import { ratingText } from '../../core/models/review.model';
import { ReviewsComponent } from '../../shared/ui/reviews.component';
import { DetailModalComponent } from '../../shared/ui/detail-modal.component';
import { listPager, PagerComponent } from '../../shared/ui/pager.component';
import { FeaturedCard, FeaturedSectionComponent } from '../../shared/ui/featured-section.component';
import { FeaturedEditorComponent } from '../../shared/ui/featured-editor.component';
import { DEFAULT_BANNER, DEFAULT_BANNER_CREDIT, DEFAULT_BANNER_SRCSET, editableBanner, PageBannerComponent } from '../../shared/ui/page-banner.component';

const CONFIGS: Record<PlaceType, PlaceTypeConfig> = {
  cafe: CAFE_CONFIG,
  restaurant: RESTAURANT_CONFIG,
  bar: BAR_CONFIG,
};

const TYPE_FILTERS: { value: PlaceType | ''; label: string; icon: IconName }[] = [
  { value: '', label: 'Tất cả', icon: 'compass' },
  { value: 'cafe', label: 'Cafe', icon: 'cup' },
  { value: 'bar', label: 'Bar', icon: 'cocktail' },
  { value: 'restaurant', label: 'Quán ăn', icon: 'utensils' },
];

const TYPE_LABELS: Record<PlaceType, string> = { cafe: 'Cafe', bar: 'Bar', restaurant: 'Quán ăn' };
const TYPE_ICONS: Record<PlaceType, IconName> = { cafe: 'cup', bar: 'cocktail', restaurant: 'utensils' };

/**
 * "Khám phá quán": danh mục quán do admin nhập. Mọi người xem, lọc theo khu vực và loại, rồi "Add vào
 * My place" (vào nhóm theo loại của quán). Chỉ admin thấy nút thêm mới, sửa, xoá.
 */

@Component({
  selector: 'app-explore-page',
  imports: [FilterSheetComponent, FilterGroupComponent, ChoiceChipsComponent, FilterSwitchComponent, PriceRangeInputComponent, ActiveFiltersComponent, FilterButtonComponent, PageBannerComponent, FeaturedEditorComponent, FeaturedSectionComponent, DetailModalComponent, ReviewsComponent, AutoplanDialogComponent, PhotoCarouselComponent, FitRowDirective, AddToPlanDialogComponent, VibeTagsComponent, PlaceFormComponent, ConfirmDialogComponent, IconComponent, RouterLink, PagerComponent],
  templateUrl: './explore.page.html',
})
export class ExplorePage implements OnInit, OnDestroy {
  private readonly gate = inject(LoginGate);
  private readonly seo = inject(SeoService);
  /**
   * Trang hub SEO (app.routes.ts): loại quán từ route data (/quan-cafe → cafe) và khu vực từ đường dẫn
   * (/khu-vuc/cau-giay, /quan-cafe/cau-giay). Trang /explore thường thì cả hai trống, loại / khu vực đọc từ ?loai=, ?khuvuc=.
   */
  readonly hubType = input<PlaceType | undefined>(undefined);
  readonly districtSlug = input<string | undefined>(undefined);
  protected readonly isHub = computed(() => !!this.hubType() || !!this.districtSlug());
  /** Slug khu vực trên đường dẫn không có thật: trang 404 */
  protected readonly missingDistrict = signal(false);
  protected readonly autoplanOpen = signal(false);

  /** Tiêu đề banner (H1): trang hub nêu rõ loại và khu vực, trang thường giữ "Khám phá quán." */
  protected readonly heading = computed(() => {
    if (!this.isHub()) return 'Khám phá quán.';
    const type = this.type();
    const d = this.districts().find((x) => x.code === this.district());
    return `${type ? MY_PLACE_GROUP[type] : 'Quán hẹn hò'} ở ${d?.label ?? 'Hà Nội'}.`;
  });

  ngOnDestroy(): void {
    this.seo.clear();
  }

  /** Title, mô tả, canonical và ItemList (JSON-LD) theo loại, khu vực và trang đang xem; gọi sau mỗi lần tải danh sách */
  private applySeo(): void {
    const type = this.type();
    const typeLabel = type ? MY_PLACE_GROUP[type] : '';
    const d = this.districts().find((x) => x.code === this.district());
    const where = d ? `${d.label}, Hà Nội` : 'Hà Nội';
    const title = !this.isHub()
      ? 'Khám phá quán hẹn hò ở Hà Nội: cafe, bar, quán ăn'
      : typeLabel
        ? `${typeLabel} hẹn hò ở ${where}`
        : `Quán hẹn hò ở ${where}: cafe, bar, quán ăn`;
    const path = this.isHub() ? this.router.url.split('?')[0] : '/explore';
    const page = this.pager.page();
    this.seo.set({
      title,
      description: `${this.total() || ''} ${(typeLabel || 'quán').toLowerCase()} ở ${where} cho buổi hẹn: ảnh, giờ mở cửa, giá mỗi người, đánh giá thật. Lọc theo kiểu hẹn chill, năng động, lãng mạn trên HANOIVIBE.`.trim(),
      path: page > 1 ? `${path}?trang=${page}` : path,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: title,
        url: this.seo.absolute(path),
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: this.total(),
          itemListElement: this.items().map((item, i) => ({
            '@type': 'ListItem',
            position: (page - 1) * this.pager.size + i + 1,
            name: item.name,
            url: this.seo.absolute('/quan/' + item.slug),
          })),
        },
      },
    });
  }

  /** Trên trang hub, đổi loại / khu vực thì sang /explore với bộ lọc tương ứng (hub chỉ đúng một loại / khu vực) */
  private leaveHub(patch: Record<string, string | null>): void {
    void this.router.navigate(['/explore'], {
      queryParams: { ...this.route.snapshot.queryParams, loai: this.type() || null, khuvuc: this.district() || null, ...patch },
    });
  }
  protected readonly photosOf = photosOf;
  /** Wifi / đậu xe của quán, cho popup chi tiết */
  protected amenities(d: CatalogItem): string {
    return [d.hasWifi ? 'Wifi' : '', d.hasParking ? 'Đậu xe' : ''].filter((x) => x).join(' · ') || '—';
  }

  /** Quán đang xem chi tiết (popup) */
  protected readonly detail = signal<CatalogItem | null>(null);
  /** Đang chọn plan để thêm quán / chỗ chơi này vào */
  protected readonly planTarget = signal<{ kind: StopKind; refId: string; name: string; district: string } | null>(null);
  private readonly catalog = inject(CatalogService);
  private readonly placeService = inject(PlaceService);
  private readonly toast = inject(ToastService);

  protected readonly typeLabels = TYPE_LABELS;
  protected readonly typeIcons = TYPE_ICONS;
  protected readonly configs = CONFIGS;
  protected readonly typeFilters = TYPE_FILTERS;
  protected readonly newTypes = TYPE_FILTERS.filter((t) => t.value !== '') as { value: PlaceType; label: string }[];
  protected readonly canEdit = inject(AuthService).canEdit;

  protected readonly q = signal('');
  protected readonly type = signal<PlaceType | ''>('');
  protected readonly district = signal('');
  protected readonly districts = signal<DistrictOption[]>([]);
  protected readonly items = signal<CatalogItem[]>([]);
  /** Ảnh nền banner (admin đổi được); chưa có thì dùng Hồ Gươm đêm */
  protected readonly banner = editableBanner('explore');
  protected readonly defaultBanner = DEFAULT_BANNER;
  protected readonly defaultSrcset = DEFAULT_BANNER_SRCSET;
  protected readonly defaultCredit = DEFAULT_BANNER_CREDIT;

  protected cityHint(): void {
    this.toast.show('Sắp có thêm thành phố khác. Hiện HANOIVIBE dành cho Hà Nội.', 'info');
  }

  /** Tiêu đề khu danh sách theo chip loại quán đang chọn */
  protected typeTitle(): string {
    return this.typeFilters.find((t) => t.value === this.type())?.label ?? 'Tất cả quán';
  }

  /** Điểm hẹn nổi bật (admin chọn; trang chủ cũng chọn cùng danh sách này) */
  protected readonly featured = signal<FeaturedItem[]>([]);
  protected readonly featuredEditorOpen = signal(false);
  protected readonly featuredCards = computed<FeaturedCard[]>(() =>
    this.featured().map((f) => ({
      id: f.place.id,
      position: f.position,
      kicker: f.kicker,
      headline: f.headline,
      imageUrl: f.place.imageUrl || null,
      meta: `${TYPE_LABELS[f.place.type]} · ${f.place.districtLabel}`,
      name: f.place.name,
      address: f.place.address,
      rating: f.place.ratingCount && f.place.ratingAvg !== null ? ratingText(f.place.ratingAvg) : null,
      note: null,
    })),
  );
  protected readonly featuredSlots = computed(() => this.featured().map((f) => ({ id: f.place.id, kicker: f.kicker, headline: f.headline })));

  protected openFeatured(id: string): void {
    const f = this.featured().find((x) => x.place.id === id);
    if (f) this.detail.set(f.place);
  }

  protected reloadFeatured(): void {
    void this.catalog.featured().then((f) => this.featured.set(f)).catch(() => undefined);
  }

  protected readonly rating = ratingText;

  /** Mình vừa viết / sửa / xoá đánh giá trong popup: cập nhật sao trên thẻ */
  protected onRatingChange(id: string, r: { ratingAvg: number | null; ratingCount: number }): void {
    this.items.update((list) => list.map((i) => (i.id === id ? { ...i, ...r } : i)));
    if (this.detail()?.id === id) this.detail.set({ ...this.detail()!, ...r });
  }
  /** Số quán theo loại cho chip (theo từ khoá + khu vực) */
  protected readonly counts = signal<TypeCounts | null>(null);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  /** id quán đang được add vào My place */
  protected readonly adding = signal<string | null>(null);

  protected readonly typeMenuOpen = signal(false);
  /** Loại quán của form đang mở (null = đóng) */
  protected readonly formType = signal<PlaceType | null>(null);
  protected readonly editing = signal<CatalogItem | null>(null);
  protected readonly pendingDelete = signal<CatalogItem | null>(null);
  private readonly saving = signal(false);

  /** Trang đang xem (?trang= trên đường dẫn), mỗi trang 20 */
  protected readonly pager = listPager('danh-sach');
  private searchTimer?: ReturnType<typeof setTimeout>;
  /** Bỏ kết quả của lần tải cũ nếu người dùng đã đổi bộ lọc */
  private requestSeq = 0;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** Bộ lọc chi tiết (bảng "Bộ lọc"): áp dụng ngay, ghi lên đường dẫn */
  protected readonly filters = signal<PlaceFilters>(EMPTY_PLACE_FILTERS);
  protected readonly filterOpen = signal(false);
  /** Chip loại quán trong bảng lọc, kèm số quán theo từ khoá + khu vực + bộ lọc khác */
  protected readonly typeOptions = computed(() =>
    this.typeFilters.map((t) => ({ value: t.value, label: `${t.label} · ${this.counts()?.[t.value || 'all'] ?? '–'}`, icon: t.icon })),
  );
  /** Loại quán đứng đầu hàng chip đang lọc (bỏ chip = về Tất cả) */
  protected readonly filterChips = computed(() => [
    ...(this.type() ? [{ key: 'type', label: this.typeFilters.find((t) => t.value === this.type())?.label ?? '' }] : []),
    ...placeFilterChips(this.filters()),
  ]);
  protected readonly filterCount = computed(() => placeFilterCount(this.filters()) + (this.type() ? 1 : 0));
  protected readonly starOptions = STAR_OPTIONS;
  protected readonly cuisineOptions = CUISINE_OPTIONS;
  protected readonly vibeOptions = VIBE_OPTIONS;
  protected readonly sortOptions = PLACE_SORTS;
  protected readonly toggleIn = toggleIn;
  private filterTimer?: ReturnType<typeof setTimeout>;

  protected setFilter(patch: Partial<PlaceFilters>): void {
    this.applyFilters({ ...this.filters(), ...patch });
  }

  protected removeFilter(key: string): void {
    if (key === 'type') return this.setType('');
    this.applyFilters(removePlaceFilter(this.filters(), key));
  }

  protected clearFilters(): void {
    if (this.type()) this.setType('');
    this.applyFilters(EMPTY_PLACE_FILTERS);
  }

  /** Chọn khu vực ('' = mọi khu vực); ghi ?khuvuc= lên đường dẫn để Back / link giữ đúng danh sách */
  protected setDistrict(code: string): void {
    if (this.isHub()) return this.leaveHub({ khuvuc: code || null });
    this.district.set(code);
    void this.router.navigate([], { queryParams: { khuvuc: code || null }, queryParamsHandling: 'merge', replaceUrl: true });
    void this.reload();
  }

  /** Chọn loại quán (chip "Tất cả" = ''); bấm lại loại đang chọn thì về Tất cả. Ghi ?loai= lên đường dẫn. */
  protected setType(value: PlaceType | ''): void {
    const next = value && value === this.type() ? '' : value;
    if (next === this.type()) return;
    if (this.isHub()) return this.leaveHub({ loai: next || null });
    this.type.set(next);
    void this.router.navigate([], { queryParams: { loai: next || null }, queryParamsHandling: 'merge', replaceUrl: true });
    void this.reload(false);
  }

  /** Chọn loại món ở "Tất cả": chuyển sang Quán ăn (chỉ quán ăn có loại món) */
  protected pickCuisine(cuisine: string): void {
    const cuisines = toggleIn(this.filters().cuisines, cuisine);
    if (cuisines.length && this.type() !== 'restaurant') {
      this.type.set('restaurant');
      void this.router.navigate([], { queryParams: { loai: 'restaurant' }, queryParamsHandling: 'merge', replaceUrl: true });
    }
    this.setFilter({ cuisines });
  }

  private applyFilters(next: PlaceFilters): void {
    this.filters.set(next);
    void this.router.navigate([], { queryParams: placeFiltersToParams(next), queryParamsHandling: 'merge', replaceUrl: true });
    clearTimeout(this.filterTimer);
    this.filterTimer = setTimeout(() => void this.reload(), 200);
  }

  /** Bộ lọc chi tiết dạng tham số API */
  private filterQuery() {
    const f = this.filters();
    return {
      priceMin: f.priceMin,
      priceMax: f.priceMax,
      stars: f.stars,
      cuisine: f.cuisines,
      vibe: f.vibes,
      openAt: f.openNow ? nowHHmm() : '',
      wifi: f.wifi,
      parking: f.parking,
    };
  }

  async ngOnInit(): Promise<void> {
    const districtsLoaded = this.catalog
      .districts()
      .then((d) => this.districts.set(d))
      .catch(() => undefined);
    this.reloadFeatured();
    this.banner.load();
    // Mở từ "Gợi ý điểm hẹn" của Tìm đối tượng: /explore?q=<tên quán>
    const params = this.route.snapshot.queryParamMap;
    this.q.set(params.get('q') ?? '');
    this.filters.set(placeFiltersFromParams(Object.fromEntries(params.keys.map((k) => [k, params.get(k)]))));
    if (this.isHub()) {
      this.type.set(this.hubType() ?? '');
      const slug = this.districtSlug();
      if (slug) {
        await districtsLoaded;
        const d = this.districts().find((x) => x.slug === slug);
        if (!d) {
          this.missingDistrict.set(true);
          this.seo.notFound('Không có khu vực này', this.router.url.split('?')[0]);
          return;
        }
        this.district.set(d.code);
      }
    } else {
      this.district.set(params.get('khuvuc') ?? '');
      const loai = params.get('loai');
      this.type.set(this.typeFilters.some((t) => t.value && t.value === loai) ? (loai as PlaceType) : '');
    }
    await this.reload(true, true);
    // Tên khu vực trong title / mô tả cần danh sách khu vực đã về
    await districtsLoaded;
    this.applySeo();
  }

  protected onSearch(value: string): void {
    this.q.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.reload(), 300);
  }

  /** {@code withCounts}: tính lại số trên chip (đổi loại thì không cần, số không theo loại). */
  /**
   * {@code keepPage}: giữ trang đang xem (mở trang, sau khi admin thêm / sửa / xoá); mặc định về trang 1 vì bộ lọc vừa đổi.
   */
  protected async reload(withCounts = true, keepPage = false): Promise<void> {
    if (!keepPage) this.pager.reset();
    if (withCounts) {
      const filter = { q: this.q().trim(), district: this.district(), ...this.filterQuery() };
      const key = JSON.stringify(filter);
      void this.catalog.counts(filter).then((c) => {
        // Bỏ kết quả cũ nếu bộ lọc đã đổi trong lúc chờ
        if (key === JSON.stringify({ q: this.q().trim(), district: this.district(), ...this.filterQuery() })) this.counts.set(c);
      });
    }
    await this.load();
  }

  /** Bấm số trang ở thanh phân trang */
  protected async goPage(n: number): Promise<void> {
    this.pager.go(n);
    await this.load();
  }

  private async load(): Promise<void> {
    const seq = ++this.requestSeq;
    this.loading.set(true);
    try {
      const res = await this.catalog.search({
        q: this.q().trim(),
        type: this.type(),
        district: this.district(),
        ...this.filterQuery(),
        sort: this.filters().sort,
        page: this.pager.page() - 1,
        size: this.pager.size,
      });
      if (seq !== this.requestSeq) return;
      this.items.set(res.items);
      this.total.set(res.total);
      // Trang trên đường dẫn vượt quá số trang (vd. vừa xoá mục cuối của trang cuối): lùi về trang cuối
      if (!res.items.length && res.total && this.pager.page() > 1) {
        this.pager.clamp(res.total);
        await this.load();
        return;
      }
      this.applySeo();
    } finally {
      if (seq === this.requestSeq) this.loading.set(false);
    }
  }

  /** 4 → { on: '★★★★', off: '★' } */
  protected stars(rating: number): { on: string; off: string } {
    return { on: '★'.repeat(rating), off: '★'.repeat(5 - rating) };
  }

  protected priceText(item: CatalogItem): string {
    return placePriceDetail(item);
  }

  /** Huy hiệu trên thẻ: "80k–150k/người" như chỗ chơi; chưa nhập giá thì rỗng (không hiện) */
  protected cardPrice(item: CatalogItem): string {
    return placePriceText(item);
  }

  protected mapUrl(item: CatalogItem): string {
    return item.googleMapsUrl || viewOnMapUrl(item.lat, item.lng, `${item.name} ${item.address}`);
  }

  protected directions(item: CatalogItem): string {
    return directionsUrl(item.lat, item.lng, `${item.name} ${item.address}`);
  }

  /** Vào đúng nhóm theo loại của quán; thông báo "Đã được add vào Quán cafe/bar/ăn". */
  /** Khách: mời đăng ký trước khi lập plan */
  protected addToPlan(t: { kind: StopKind; refId: string; name: string; district: string }): void {
    if (this.gate.check('lập plan hẹn hò', () => this.planTarget.set(t))) this.planTarget.set(t);
  }

  protected async addToMyPlace(item: CatalogItem): Promise<void> {
    if (!this.gate.check('lưu quán vào My place', () => this.addToMyPlace(item))) return;
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

  protected async save(place: Place & Pick<CatalogRequest, 'vibes' | 'vibesAuto'>): Promise<void> {
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
      await this.reload(true, true);
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
      await this.reload(true, true);
    } catch {
      // errorInterceptor đã hiện thông báo
    }
  }

  private markInMyPlace(id: string): void {
    this.items.update((list) => list.map((i) => (i.id === id ? { ...i, inMyPlace: true } : i)));
  }
}
