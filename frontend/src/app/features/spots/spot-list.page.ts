import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
  imports: [FilterSheetComponent, FilterGroupComponent, ChoiceChipsComponent, FilterSwitchComponent, ActiveFiltersComponent, FilterButtonComponent, PageBannerComponent, AutoplanDialogComponent, SpotDetailDialogComponent, PhotoCarouselComponent, FitRowDirective, AddToPlanDialogComponent, VibeTagsComponent, SpotFormComponent, ConfirmDialogComponent, IconComponent],
  template: `
    <div class="flex flex-col gap-3 px-4 pb-10 pt-4 sm:px-6 lg:px-8 lg:pt-5">
      <!-- Banner đầu trang như Khám phá quán: ảnh nền (admin đổi được; chưa đổi thì lấy ảnh chỗ chơi nổi bật đầu tiên) -->
      <app-page-banner
        kicker="Hà Nội, ngoài quán xá"
        heading="Tìm chỗ chơi."
        tagline="Music box, workshop, bảo tàng, dạo phố. Hẹn hò đâu chỉ ở quán."
        [image]="bannerImage()"
        [imageSrcset]="bannerImage() === defaultBanner ? defaultSrcset : null"
        [imagePosition]="bannerImage() === defaultBanner ? '70% 28%' : 'center'"
        [credit]="bannerImage() === defaultBanner ? defaultCredit : null"
        [editable]="canEdit()"
        [custom]="!!banner.custom()"
        [busy]="banner.busy()"
        (upload)="banner.upload($event)"
        (reset)="banner.reset()"
      >
        <button
          bannerLeft
          type="button"
          class="flex h-9 items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 text-[13px] font-medium text-white backdrop-blur transition hover:bg-white/25"
          (click)="cityHint()"
        >
          <app-icon name="pin" [size]="15" />Hà Nội<app-icon name="chevronDown" [size]="14" />
        </button>
        <button
          bannerRight
          type="button"
          class="flex h-9 items-center gap-1 rounded-full bg-white px-2 text-[12px] font-semibold text-brand-700 shadow-md shadow-brand-900/20 transition hover:bg-brand-50 sm:px-3"
          aria-label="Autoplan buổi hẹn"
          (click)="autoplanOpen.set(true)"
        >
          <app-icon name="shuffle" [size]="14" /><span class="max-sm:hidden">Autoplan buổi hẹn</span>
        </button>
        @if (canEdit()) {
          <button
            bannerRight
            type="button"
            class="flex h-9 items-center gap-1 rounded-full bg-brand-600 px-2 text-[12px] font-semibold text-white shadow-md shadow-brand-900/30 transition hover:bg-brand-700 sm:px-3"
            aria-label="Thêm chỗ chơi"
            (click)="openCreate()"
          >
            <app-icon name="plus" [size]="14" [stroke]="2.4" /><span class="max-sm:hidden">Thêm chỗ chơi</span>
          </button>
        }

        <div class="flex flex-wrap items-center gap-2">
            <label class="flex h-11 min-w-0 flex-[1_1_100%] items-center gap-2.5 rounded-full bg-white px-4 text-slate-500 shadow-lg shadow-brand-900/20 sm:max-w-[420px] sm:flex-[1_1_280px]">
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
            <!-- Điện thoại: khu vực và Bộ lọc gom thành một hàng vuốt ngang (sm:contents: màn rộng xếp chung hàng trên); nhóm chỗ chơi nằm trong Bộ lọc -->
            <div role="group" aria-label="Khu vực và bộ lọc" class="flex gap-2 max-sm:-mx-4 max-sm:w-[calc(100%+2rem)] max-sm:overflow-x-auto max-sm:px-4 max-sm:[scrollbar-width:none] *:shrink-0 *:whitespace-nowrap sm:contents">
              <label class="flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm text-slate-700 shadow-lg shadow-brand-900/20">
                <span class="text-brand-600"><app-icon name="pin" [size]="18" /></span>
                <span class="sr-only">Khu vực</span>
                <select
                  [value]="district()"
                  (change)="setDistrict($any($event.target).value)"
                  class="cursor-pointer bg-transparent text-sm text-slate-900 outline-none"
                >
                  <option value="">Mọi khu vực</option>
                  @for (d of districts(); track d.code) {
                    <option [value]="d.code">{{ d.label }}</option>
                  }
                </select>
              </label>
              <app-filter-button [count]="filterCount()" (open)="filterOpen.set(true)" />
            </div>
        </div>
      </app-page-banner>


      <app-active-filters [items]="filterChips()" (remove)="removeFilter($event)" (clear)="clearFilters()" />
      @if (loading() && items().length === 0) {
        <p class="text-sm text-slate-500">Đang tải…</p>
      } @else if (items().length === 0) {
        <div class="rounded-[20px] border border-dashed border-brand-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          {{ hasFilter() ? 'Không tìm thấy chỗ nào hợp bộ lọc. Thử bỏ bớt bộ lọc nhé.' : 'Chưa có chỗ chơi nào.' }}
        </div>
      } @else {
        <h2 class="mt-2 flex items-baseline gap-2 text-lg font-bold tracking-tight text-slate-900">
          {{ categoryTitle() }}<span class="text-sm font-medium text-slate-500">{{ total() }} chỗ</span>
        </h2>
        <!-- Hàng thẻ đầu vừa khít màn hình, hàng sau cuộn mới thấy -->
        <div appFitRow class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          @for (item of items(); track item.id) {
            <article
              class="flex h-[var(--row-h,420px)] cursor-pointer flex-col overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(48,30,110,0.04),0_8px_24px_rgba(48,30,110,0.05)] transition hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-brand-500"
              tabindex="0"
              role="button"
              [attr.aria-label]="'Xem chi tiết ' + item.name"
              (click)="detail.set(item)"
              (keydown.enter)="detail.set(item)"
            >
              <div class="relative flex min-h-0 flex-[0_1_75%] items-center justify-center bg-[#EFEAFC] text-brand-500">
                @if (item.imageUrl) {
                  <app-photo-carousel class="h-full w-full" [photos]="photosOf(item)" [alt]="item.name" [variants]="true" />
                } @else {
                  <app-icon [name]="cat(item).icon" [size]="44" [stroke]="1.5" />
                }
                <span class="absolute left-3 top-3 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-brand-800" [title]="cat(item).label">
                  {{ shortLabel(item) }}
                </span>
                <span class="absolute right-3 top-3 rounded-full bg-slate-900/70 px-2.5 py-1 text-xs font-medium text-white">
                  {{ price(item) }}
                </span>
                @if (canEdit()) {
                  <div class="absolute bottom-3 right-3 flex gap-1.5" (click)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()">
                    <button type="button" class="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm text-slate-600 hover:text-brand-700" title="Sửa" (click)="openEdit(item)"><app-icon name="edit" [size]="14" /></button>
                    <button type="button" class="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm text-rose-600 hover:text-rose-700" title="Xoá" (click)="pendingDelete.set(item)"><app-icon name="trash" [size]="14" /></button>
                  </div>
                }
                @if (item.needsBooking) {
                  <span class="absolute bottom-3 left-3 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                    Cần đặt trước
                  </span>
                }
              </div>
              <div class="flex flex-[1_0_25%] flex-col justify-between gap-2 px-3.5 pb-3 pt-2.5">
                <div class="flex min-w-0 flex-col gap-1">
                  <h2 class="truncate text-base font-bold tracking-tight text-slate-900" [title]="item.name">{{ item.name }}</h2>
                  <div class="flex items-center gap-2">
                    @if (item.ratingCount && item.ratingAvg !== null) {
                      <span class="shrink-0 text-[13px] font-semibold text-slate-700" [attr.aria-label]="'Đánh giá ' + rating(item.ratingAvg) + ' trên 5, ' + item.ratingCount + ' lượt'"><span class="text-[#E29A2D]">★</span> {{ rating(item.ratingAvg) }} <span class="font-normal text-slate-400">({{ item.ratingCount }})</span></span>
                    }
                    <span class="min-w-0 flex-1 truncate text-[13px] text-slate-500">{{ item.address || 'Chưa có địa chỉ' }} · <span class="font-medium text-slate-600">{{ item.districtLabel }}</span></span>
                    <app-vibe-tags class="shrink-0" [vibes]="item.vibes" />
                  </div>
                </div>
                <!-- Một nút chính (Lưu); Chỉ đường / Vào plan là icon, rê chuột thì hiện chữ -->
                <div class="flex items-center gap-1.5" (click)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()">
                  <a [href]="directions(item)" target="_blank" rel="noopener" class="group/act flex h-9 touch:h-10 items-center rounded-[10px] border border-brand-200 px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-brand-50 focus-visible:bg-brand-50" aria-label="Chỉ đường" title="Chỉ đường">
                    <app-icon name="navigate" [size]="15" /><span class="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover/act:ml-1 group-hover/act:max-w-[80px] group-hover/act:opacity-100 group-focus-visible/act:ml-1 group-focus-visible/act:max-w-[80px] group-focus-visible/act:opacity-100 touch:ml-1 touch:max-w-none touch:opacity-100">Chỉ đường</span>
                  </a>
                  <button type="button" class="group/act flex h-9 touch:h-10 items-center rounded-[10px] border border-brand-200 px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-brand-50 focus-visible:bg-brand-50" aria-label="Vào plan" title="Vào plan" (click)="addToPlan({ kind: 'spot', refId: item.id, name: item.name, district: item.district })">
                    <app-icon name="route" [size]="15" /><span class="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover/act:ml-1 group-hover/act:max-w-[80px] group-hover/act:opacity-100 group-focus-visible/act:ml-1 group-focus-visible/act:max-w-[80px] group-focus-visible/act:opacity-100 touch:ml-1 touch:max-w-none touch:opacity-100">Vào plan</span>
                  </button>
                  @if (item.inMyPlace) {
                    <span class="flex min-h-9 touch:min-h-10 min-w-0 flex-1 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-[10px] bg-brand-100 px-2 text-xs font-semibold text-brand-800">
                      <app-icon name="heart" [size]="14" [filled]="true" />Đã lưu
                    </span>
                  } @else {
                    <button
                      type="button"
                      class="flex min-h-9 touch:min-h-10 min-w-0 flex-1 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-[10px] bg-brand-600 px-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                      [disabled]="savingSpot() === item.id"
                      (click)="saveSpot(item)"
                    >
                      <app-icon name="plus" [size]="14" [stroke]="2.4" />Lưu
                    </button>
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
              class="min-h-10 rounded-xl border border-brand-200 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-brand-50 disabled:opacity-60"
              [disabled]="loading()"
              (click)="loadMore()"
            >
              {{ loading() ? 'Đang tải…' : 'Xem thêm' }}
            </button>
          </div>
        }
      }
    </div>

    @if (filterOpen()) {
      <app-filter-sheet [resultLabel]="'Xem ' + total() + ' chỗ'" [activeCount]="filterCount()" (closed)="filterOpen.set(false)" (cleared)="clearFilters()">
        <app-filter-group title="Nhóm chỗ chơi">
          <app-choice-chips [options]="categoryOptions()" [selected]="[category()]" (toggle)="setCategory($any($event))" />
        </app-filter-group>
        <app-filter-group title="Ngân sách" hint="giá thấp nhất mỗi người">
          <app-choice-chips [options]="budgetOptions" [selected]="[filters().budget]" (toggle)="setFilter({ budget: filters().budget === $event ? null : $any($event) })" />
        </app-filter-group>
        <app-filter-group title="Thời lượng">
          <app-choice-chips [options]="durationOptions" [selected]="[filters().duration]" (toggle)="setFilter({ duration: filters().duration === $event ? '' : $any($event) })" />
        </app-filter-group>
        <app-filter-group title="Kiểu hẹn">
          <app-choice-chips [options]="vibeOptions" [selected]="filters().vibes" (toggle)="setFilter({ vibes: toggleIn(filters().vibes, $any($event)) })" />
        </app-filter-group>
        <app-filter-group title="Giờ mở cửa & thời tiết">
          <div class="flex flex-col gap-2">
            <app-filter-switch label="Đang mở cửa" icon="clock" [on]="filters().openNow" (toggle)="setFilter({ openNow: !filters().openNow })" />
            <app-filter-switch label="Ngày mưa: chỉ chỗ trong nhà" icon="umbrella" [on]="filters().rainy" (toggle)="setFilter({ rainy: !filters().rainy })" />
            <app-filter-switch label="Không cần đặt trước" icon="calendar" [on]="filters().noBooking" (toggle)="setFilter({ noBooking: !filters().noBooking })" />
          </div>
        </app-filter-group>
        <app-filter-group title="Sắp xếp">
          <app-choice-chips [options]="sortOptions" [selected]="[filters().sort]" (toggle)="setFilter({ sort: $any($event) })" />
        </app-filter-group>
      </app-filter-sheet>
    }

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

    @if (planTarget(); as t) {
      <app-add-to-plan-dialog [kind]="t.kind" [refId]="t.refId" [name]="t.name" [district]="t.district" (closed)="planTarget.set(null)" />
    }

    @if (autoplanOpen()) {
      <app-autoplan-dialog (closed)="autoplanOpen.set(false)" />
    }

    @if (detail(); as d) {
      <app-spot-detail-dialog
        [spot]="d"
        [saved]="d.inMyPlace"
        (closed)="detail.set(null)"
        (plan)="detail.set(null); addToPlan({ kind: 'spot', refId: $event.id, name: $event.name, district: $event.district })"
        (save)="saveSpot($event)"
        (ratingChange)="onRatingChange(d.id, $event)"
      />
    }
  `,
})
export class SpotListPage implements OnInit {
  private readonly gate = inject(LoginGate);
  private readonly savedSpots = inject(SavedSpotService);
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

  private page = 0;
  private searchTimer?: ReturnType<typeof setTimeout>;
  /** Bỏ kết quả của lần tải cũ nếu người dùng đã đổi bộ lọc */
  private requestSeq = 0;

  protected readonly autoplanOpen = signal(false);

  /** Chỗ chơi nổi bật (admin chọn ở trang chủ): chỉ dùng ảnh đầu làm nền banner khi admin chưa đổi ảnh; featuredLoaded: đã biết */
  private readonly featured = signal<FeaturedSpot[]>([]);
  private readonly featuredLoaded = signal(false);

  /** Ảnh nền banner: ảnh admin chọn, không thì ảnh chỗ chơi nổi bật đầu tiên, không nữa thì Hồ Gươm đêm */
  protected readonly banner = editableBanner('spots');
  protected readonly defaultBanner = DEFAULT_BANNER;
  protected readonly defaultCredit = DEFAULT_BANNER_CREDIT;
  protected readonly defaultSrcset = DEFAULT_BANNER_SRCSET;
  /** Hiện ảnh mặc định ngay (ảnh đầu trang, không chờ API); biết ảnh admin / nổi bật thì đổi sang */
  protected readonly bannerImage = computed(() => {
    if (!this.banner.ready() || !this.featuredLoaded()) return DEFAULT_BANNER;
    return this.banner.custom() ?? this.featured().find((f) => f.spot.imageUrl)?.spot.imageUrl ?? DEFAULT_BANNER;
  });

  async ngOnInit(): Promise<void> {
    const params = this.route.snapshot.queryParamMap;
    const nhom = params.get('nhom');
    this.category.set(this.categories.some((c) => c.value === nhom) ? (nhom as SpotCategory) : '');
    this.filters.set(spotFiltersFromParams(Object.fromEntries(params.keys.map((k) => [k, params.get(k)]))));
    this.district.set(params.get('khuvuc') ?? '');
    void this.catalog.districts().then((d) => this.districts.set(d));
    this.reloadFeatured();
    this.banner.load();
    await this.reload();
  }

  private reloadFeatured(): void {
    void this.spots
      .featured()
      .then((f) => this.featured.set(f))
      .catch(() => undefined)
      .finally(() => this.featuredLoaded.set(true));
  }

  /** Chọn khu vực ('' = mọi khu vực); ghi ?khuvuc= lên đường dẫn */
  protected setDistrict(code: string): void {
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
      maxPrice: this.filters().budget,
      indoor: this.filters().rainy ? true : null,
      openAt: this.filters().openNow ? nowHHmm() : '',
      ...(this.filters().duration ? DURATION_RANGES[this.filters().duration as Exclude<SpotDuration, ''>] : {}),
      noBooking: this.filters().noBooking,
      vibe: this.filters().vibes,
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
      const res = await this.spots.search({ ...this.filter(), category: this.category(), sort: this.filters().sort, page: this.page, size: 30 });
      if (seq !== this.requestSeq) return;
      this.items.set(append ? [...this.items(), ...res.items] : res.items);
      this.total.set(res.total);
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
