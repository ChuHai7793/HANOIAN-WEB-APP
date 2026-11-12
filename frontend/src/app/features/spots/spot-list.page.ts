import { Component, computed, inject, input, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SeoService } from '../../core/seo/seo.service';
import {
  DURATION_OPTIONS,
  DURATION_RANGES,
  EMPTY_SPOT_FILTERS,
  nowHHmm,
  removeSpotFilter,
  SPOT_BUDGETS,
  SPOT_SORTS,
  SpotDuration,
  SpotFilters,
  spotFilterChips,
  spotFilterCount,
  spotFiltersFromParams,
  spotFiltersToParams,
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
} from '../../shared/ui/filter-sheet.component';
import { errorCode, problemOf } from '../../core/api/api';
import { AuthService } from '../../core/auth/auth.service';
import { DistrictOption } from '../../core/models/catalog.model';
import {
  durationText,
  FeaturedSpot,
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
import { VibeTagsComponent } from '../../shared/ui/vibe-tags.component';
import { AddToPlanDialogComponent } from '../plans/add-to-plan-dialog.component';
import { StopKind } from '../../core/models/plan.model';
import { FitRowDirective } from '../../shared/ui/fit-row.directive';
import { PhotoCarouselComponent } from '../../shared/ui/photo-carousel.component';
import { photosOf } from '../../core/models/place.model';
import { SavedSpotService } from '../../core/services/saved-spot.service';
import { SpotDetailDialogComponent } from './spot-detail-dialog.component';
import { LoginGate } from '../../core/auth/login-gate.service';
import { ratingText } from '../../core/models/review.model';
import { AutoplanDialogComponent } from '../plans/autoplan-dialog.component';
import { listPager, PagerComponent } from '../../shared/ui/pager.component';
import { FeaturedCard, FeaturedSectionComponent } from '../../shared/ui/featured-section.component';
import { FeaturedEditorComponent } from '../../shared/ui/featured-editor.component';
import { DEFAULT_BANNER, DEFAULT_BANNER_CREDIT, DEFAULT_BANNER_SRCSET, editableBanner, PageBannerComponent } from '../../shared/ui/page-banner.component';

/** "Giải trí trong nhà" → "Giải trí": nhãn ngắn cho thẻ và chip */
function shortCategory(value: SpotCategory): string {
  return SPOT_CATEGORIES.find((c) => c.value === value)?.short ?? spotCategory(value).label;
}

/**
 * "Tìm chỗ chơi": chỗ hẹn hò không phải quán (music box, workshop, bảo tàng, dạo hồ...) do admin nhập.
 * Mọi người xem và lọc; chỉ admin thấy nút thêm mới, sửa, xoá.
 */
@Component({
  selector: 'app-spot-list-page',
  imports: [FilterSheetComponent, FilterGroupComponent, ChoiceChipsComponent, FilterSwitchComponent, ActiveFiltersComponent, FilterButtonComponent, PageBannerComponent, FeaturedSectionComponent, FeaturedEditorComponent, AutoplanDialogComponent, SpotDetailDialogComponent, PhotoCarouselComponent, FitRowDirective, AddToPlanDialogComponent, VibeTagsComponent, SpotFormComponent, ConfirmDialogComponent, IconComponent, PagerComponent, RouterLink],
  templateUrl: './spot-list.page.html',
})
export class SpotListPage implements OnInit, OnDestroy {
  private readonly gate = inject(LoginGate);
  private readonly seo = inject(SeoService);
  private readonly savedSpots = inject(SavedSpotService);
  /** Trang hub SEO /cho-choi/khu-vuc/:districtSlug: khu vực lấy từ đường dẫn thay vì ?khuvuc= */
  readonly districtSlug = input<string | undefined>(undefined);
  protected readonly isHub = computed(() => !!this.districtSlug());
  protected readonly missingDistrict = signal(false);

  /** Tiêu đề banner (H1): trang hub nêu rõ khu vực */
  protected readonly heading = computed(() => {
    if (!this.isHub()) return 'Tìm chỗ chơi.';
    const d = this.districts().find((x) => x.code === this.district());
    return `Chỗ chơi ở ${d?.label ?? 'Hà Nội'}.`;
  });

  ngOnDestroy(): void {
    this.seo.clear();
  }

  /** Title, mô tả, canonical và ItemList (JSON-LD) theo khu vực và trang đang xem; gọi sau mỗi lần tải danh sách */
  private applySeo(): void {
    const d = this.districts().find((x) => x.code === this.district());
    const where = d ? `${d.label}, Hà Nội` : 'Hà Nội';
    const title = this.isHub() ? `Chỗ chơi hẹn hò ở ${where}` : 'Tìm chỗ chơi hẹn hò ở Hà Nội: workshop, bảo tàng, dạo phố, chợ đêm';
    const path = this.isHub() ? this.router.url.split('?')[0] : '/spots';
    const page = this.pager.page();
    this.seo.set({
      title,
      description: `${this.total() || ''} chỗ chơi ở ${where} cho buổi hẹn: music box, workshop, bảo tàng, dạo hồ, chợ đêm. Giá vé, giờ mở cửa, trong nhà hay ngoài trời, lọc theo kiểu hẹn trên HANOIVIBE.`.trim(),
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
            url: this.seo.absolute('/cho-choi/' + item.slug),
          })),
        },
      },
    });
  }
  protected readonly photosOf = photosOf;
  /** Chỗ chơi đang xem chi tiết (popup) */
  protected readonly detail = signal<SpotItem | null>(null);
  /** Đang chọn plan để thêm quán / chỗ chơi này vào */
  protected readonly planTarget = signal<{ kind: StopKind; refId: string; name: string; district: string } | null>(null);
  private readonly spots = inject(SpotService);
  private readonly catalog = inject(CatalogService);
  private readonly toast = inject(ToastService);

  protected readonly categories = SPOT_CATEGORIES;
  protected readonly canEdit = inject(AuthService).canEdit;
  protected readonly cat = (item: SpotItem) => spotCategory(item.category);
  protected readonly price = spotPriceText;
  protected readonly duration = durationText;

  protected readonly q = signal('');
  protected readonly category = signal<SpotCategory | ''>('');
  protected readonly district = signal('');
  protected readonly districts = signal<DistrictOption[]>([]);
  protected readonly items = signal<SpotItem[]>([]);
  protected readonly rating = ratingText;

  /** Mình vừa viết / sửa / xoá đánh giá trong popup: cập nhật sao trên thẻ */
  protected onRatingChange(id: string, r: { ratingAvg: number | null; ratingCount: number }): void {
    this.items.update((list) => list.map((i) => (i.id === id ? { ...i, ...r } : i)));
    if (this.detail()?.id === id) this.detail.set({ ...this.detail()!, ...r });
  }
  /** Số chỗ chơi theo nhóm cho chip (theo mọi bộ lọc trừ nhóm) */
  protected readonly counts = signal<Record<string, number> | null>(null);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);

  protected readonly formOpen = signal(false);
  protected readonly editing = signal<SpotItem | null>(null);
  protected readonly pendingDelete = signal<SpotItem | null>(null);
  private readonly saving = signal(false);

  /** Trang đang xem (?trang= trên đường dẫn), mỗi trang 20 */
  protected readonly pager = listPager('danh-sach');
  private searchTimer?: ReturnType<typeof setTimeout>;
  /** Bỏ kết quả của lần tải cũ nếu người dùng đã đổi bộ lọc */
  private requestSeq = 0;

  protected readonly autoplanOpen = signal(false);

  /** Chỗ chơi nổi bật (admin chọn; trang chủ cũng chọn cùng danh sách); featuredLoaded: đã biết, để chọn ảnh nền banner */
  protected readonly featured = signal<FeaturedSpot[]>([]);
  private readonly featuredLoaded = signal(false);
  protected readonly featuredEditorOpen = signal(false);
  protected readonly featuredCards = computed<FeaturedCard[]>(() =>
    this.featured().map((f) => ({
      id: f.spot.id,
      position: f.position,
      kicker: f.kicker,
      headline: f.headline,
      imageUrl: f.spot.imageUrl || null,
      meta: `${shortCategory(f.spot.category)} · ${f.spot.districtLabel}`,
      name: f.spot.name,
      address: f.spot.address,
      rating: f.spot.ratingCount && f.spot.ratingAvg !== null ? ratingText(f.spot.ratingAvg) : null,
      note: spotPriceText(f.spot),
    })),
  );
  protected readonly featuredSlots = computed(() => this.featured().map((f) => ({ id: f.spot.id, kicker: f.kicker, headline: f.headline })));

  protected openFeatured(id: string): void {
    const f = this.featured().find((x) => x.spot.id === id);
    if (f) this.detail.set(f.spot);
  }

  /** Ảnh nền banner: ảnh admin chọn, không thì ảnh chỗ chơi nổi bật đầu tiên, không nữa thì Hồ Gươm đêm */
  protected readonly banner = editableBanner('spots');
  protected readonly defaultBanner = DEFAULT_BANNER;
  protected readonly defaultCredit = DEFAULT_BANNER_CREDIT;
  protected readonly defaultSrcset = DEFAULT_BANNER_SRCSET;
  /** Chưa biết ảnh nào thì chỉ nền tím (null), không hiện tạm ảnh mặc định rồi đổi (nháy) */
  protected readonly bannerImage = computed(() => {
    if (!this.banner.ready()) return null;
    if (this.banner.custom()) return this.banner.custom();
    if (!this.featuredLoaded()) return null;
    return this.featured().find((f) => f.spot.imageUrl)?.spot.imageUrl ?? DEFAULT_BANNER;
  });

  async ngOnInit(): Promise<void> {
    const params = this.route.snapshot.queryParamMap;
    const nhom = params.get('nhom');
    this.category.set(this.categories.some((c) => c.value === nhom) ? (nhom as SpotCategory) : '');
    this.filters.set(spotFiltersFromParams(Object.fromEntries(params.keys.map((k) => [k, params.get(k)]))));
    const districtsLoaded = this.catalog
      .districts()
      .then((d) => this.districts.set(d))
      .catch(() => undefined);
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
    } else {
      this.district.set(params.get('khuvuc') ?? '');
    }
    this.reloadFeatured();
    this.banner.load();
    await this.reload(true, true);
    await districtsLoaded;
    this.applySeo();
  }

  protected reloadFeatured(): void {
    void this.spots
      .featured()
      .then((f) => this.featured.set(f))
      .catch(() => undefined)
      .finally(() => this.featuredLoaded.set(true));
  }

  /** Chọn khu vực ('' = mọi khu vực); ghi ?khuvuc= lên đường dẫn. Trang hub: sang /spots với khu vực mới. */
  protected setDistrict(code: string): void {
    if (this.isHub()) {
      void this.router.navigate(['/spots'], { queryParams: { ...this.route.snapshot.queryParams, khuvuc: code || null } });
      return;
    }
    this.district.set(code);
    void this.router.navigate([], { queryParams: { khuvuc: code || null }, queryParamsHandling: 'merge', replaceUrl: true });
    void this.reload();
  }

  protected cityHint(): void {
    this.toast.show('Sắp có thêm thành phố khác. Hiện HANOIVIBE dành cho Hà Nội.', 'info');
  }

  protected shortLabel(item: SpotItem): string {
    return shortCategory(item.category);
  }

  /** Tiêu đề khu danh sách theo nhóm đang chọn */
  protected categoryTitle(): string {
    const c = this.category();
    return c ? spotCategory(c).label : 'Tất cả chỗ chơi';
  }

  protected hasFilter(): boolean {
    return !!(this.q() || this.category() || this.district() || this.filterCount());
  }

  /** Bộ lọc chi tiết (bảng "Bộ lọc"): áp dụng ngay, ghi lên đường dẫn */
  protected readonly filters = signal<SpotFilters>(EMPTY_SPOT_FILTERS);
  protected readonly filterOpen = signal(false);
  /** Chip nhóm chỗ chơi trong bảng lọc, kèm số chỗ theo từ khoá + khu vực + bộ lọc khác */
  protected readonly categoryOptions = computed(() => [
    { value: '', label: `Tất cả · ${this.counts()?.['all'] ?? '–'}`, icon: 'compass' as const },
    ...this.categories.map((c) => ({ value: c.value, label: `${c.short} · ${this.counts()?.[c.value] ?? '–'}`, icon: c.icon })),
  ]);
  /** Nhóm đứng đầu hàng chip đang lọc (bỏ chip = về Tất cả) */
  protected readonly filterChips = computed(() => [
    ...(this.category() ? [{ key: 'category', label: spotCategory(this.category() as SpotCategory).label }] : []),
    ...spotFilterChips(this.filters()),
  ]);
  protected readonly filterCount = computed(() => spotFilterCount(this.filters()) + (this.category() ? 1 : 0));
  protected readonly budgetOptions = SPOT_BUDGETS;
  protected readonly durationOptions = DURATION_OPTIONS;
  protected readonly vibeOptions = VIBE_OPTIONS;
  protected readonly sortOptions = SPOT_SORTS;
  protected readonly toggleIn = toggleIn;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private filterTimer?: ReturnType<typeof setTimeout>;

  protected setFilter(patch: Partial<SpotFilters>): void {
    this.applyFilters({ ...this.filters(), ...patch });
  }

  protected removeFilter(key: string): void {
    if (key === 'category') return this.setCategory('');
    this.applyFilters(removeSpotFilter(this.filters(), key));
  }

  protected clearFilters(): void {
    if (this.category()) this.setCategory('');
    this.applyFilters(EMPTY_SPOT_FILTERS);
  }

  /** Chọn nhóm chỗ chơi (chip "Tất cả" = ''); bấm lại nhóm đang chọn thì về Tất cả. Ghi ?nhom= lên đường dẫn. */
  protected setCategory(value: SpotCategory | ''): void {
    const next = value && value === this.category() ? '' : value;
    if (next === this.category()) return;
    this.category.set(next);
    void this.router.navigate([], { queryParams: { nhom: next || null }, queryParamsHandling: 'merge', replaceUrl: true });
    void this.reload(false);
  }

  private applyFilters(next: SpotFilters): void {
    this.filters.set(next);
    void this.router.navigate([], { queryParams: spotFiltersToParams(next), queryParamsHandling: 'merge', replaceUrl: true });
    clearTimeout(this.filterTimer);
    this.filterTimer = setTimeout(() => void this.reload(), 200);
  }

  protected onSearch(value: string): void {
    this.q.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.reload(), 300);
  }

  /** {@code withCounts}: tính lại số trên chip (đổi nhóm thì không cần, số không theo nhóm). */
  /**
   * {@code keepPage}: giữ trang đang xem (mở trang, sau khi admin thêm / sửa / xoá); mặc định về trang 1 vì bộ lọc vừa đổi.
   */
  protected async reload(withCounts = true, keepPage = false): Promise<void> {
    if (!keepPage) this.pager.reset();
    if (withCounts) {
      const filter = this.filter();
      const key = JSON.stringify(filter);
      void this.spots.counts(filter).then((c) => {
        // Bỏ kết quả cũ nếu bộ lọc đã đổi trong lúc chờ
        if (key === JSON.stringify(this.filter())) this.counts.set(c);
      });
    }
    await this.load();
  }

  /** Bộ lọc hiện tại, trừ nhóm và trang */
  private filter() {
    return {
      q: this.q().trim(),
      district: this.district(),
      maxPrice: this.filters().budget,
      indoor: this.filters().rainy ? true : null,
      openAt: this.filters().openNow ? nowHHmm() : '',
      ...(this.filters().duration ? DURATION_RANGES[this.filters().duration as Exclude<SpotDuration, ''>] : {}),
      noBooking: this.filters().noBooking,
      vibe: this.filters().vibes,
    };
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
      const res = await this.spots.search({ ...this.filter(), category: this.category(), sort: this.filters().sort, page: this.pager.page() - 1, size: this.pager.size });
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

  /** Đang lưu chỗ chơi nào vào My place (khoá nút) */
  protected readonly savingSpot = signal<string | null>(null);

  /** Khách: mời đăng ký trước khi lập plan */
  protected addToPlan(t: { kind: StopKind; refId: string; name: string; district: string }): void {
    if (this.gate.check('lập plan hẹn hò', () => this.planTarget.set(t))) this.planTarget.set(t);
  }

  protected async saveSpot(item: SpotItem): Promise<void> {
    if (!this.gate.check('lưu chỗ chơi vào My place', () => this.saveSpot(item))) return;
    if (this.savingSpot()) return;
    this.savingSpot.set(item.id);
    try {
      const saved = await this.savedSpots.save(item);
      this.items.update((list) => list.map((i) => (i.id === saved.id ? { ...i, inMyPlace: true } : i)));
      this.featured.update((list) => list.map((f) => (f.spot.id === saved.id ? { ...f, spot: { ...f.spot, inMyPlace: true } } : f)));
      if (this.detail()?.id === saved.id) this.detail.set({ ...this.detail()!, inMyPlace: true });
      this.toast.success(`Đã lưu "${item.name}" vào My place.`);
    } finally {
      this.savingSpot.set(null);
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
      await this.reload(true, true);
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
      await this.reload(true, true);
    } catch {
      // errorInterceptor đã hiện thông báo
    }
  }
}
