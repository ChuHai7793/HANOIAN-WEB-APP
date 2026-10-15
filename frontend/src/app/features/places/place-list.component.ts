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
import { SPOT_CATEGORIES, spotCategory, SpotItem, spotPriceText } from '../../core/models/spot.model';
import { StopKind } from '../../core/models/plan.model';
import { SpotDetailDialogComponent } from '../spots/spot-detail-dialog.component';
import { AddToPlanDialogComponent } from '../plans/add-to-plan-dialog.component';
import { AutoplanDialogComponent } from '../plans/autoplan-dialog.component';
import { VibeTagsComponent } from '../../shared/ui/vibe-tags.component';
import { DEFAULT_BANNER, DEFAULT_BANNER_CREDIT, PageBannerComponent } from '../../shared/ui/page-banner.component';
import { ratingText } from '../../core/models/review.model';

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
  imports: [PageBannerComponent, AutoplanDialogComponent, VibeTagsComponent, AddToPlanDialogComponent, SpotDetailDialogComponent, PhotoCarouselComponent, FitRowDirective, RouterLink, PlaceDetailComponent, EmptyStateComponent, ConfirmDialogComponent, IconComponent],
  template: `
    <div class="flex flex-col gap-3 px-4 pb-10 pt-4 sm:px-6 lg:px-8 lg:pt-5">
      <!-- Banner như Khám phá quán: nền là ảnh một nơi đã lưu, bên phải vài ảnh đã lưu xếp kiểu polaroid -->
      <app-page-banner
        kicker="Bộ sưu tập của bạn"
        heading="My place."
        [tagline]="tagline()"
        [image]="bannerImage()"
        [imagePosition]="bannerImage() === defaultBanner ? '70% 28%' : 'center 35%'"
        [credit]="bannerImage() === defaultBanner ? defaultCredit : null"
      >
        @if (polaroids().length) {
          <div bannerAside class="pointer-events-none absolute right-12 top-16 hidden h-[150px] w-[260px] xl:block" aria-hidden="true">
            @for (src of polaroids(); track $index) {
              <img [src]="src" alt="" class="absolute h-[124px] w-[104px] rounded-xl border-4 border-white object-cover shadow-xl shadow-black/30" [class]="polaroidPos[$index]" />
            }
          </div>
        }
        <button
          bannerLeft
          type="button"
          class="flex h-9 items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 text-[13px] font-medium text-white backdrop-blur transition hover:bg-white/25 disabled:opacity-70"
          [disabled]="locating()"
          (click)="locateMe()"
        >
          <app-icon name="locate" [size]="15" />
          @if (locating()) {
            Đang lấy vị trí…
          } @else if (userLocation()) {
            Đã có vị trí của bạn
          } @else {
            Tính khoảng cách từ tôi
          }
        </button>
        <button
          bannerRight
          type="button"
          class="flex h-8 items-center gap-1 rounded-full bg-white px-2 text-[12px] font-semibold text-brand-700 shadow-md shadow-brand-900/20 transition hover:bg-brand-50 sm:px-3"
          aria-label="Autoplan buổi hẹn"
          (click)="autoplanOpen.set(true)"
        >
          <app-icon name="shuffle" [size]="14" /><span class="max-sm:hidden">Autoplan buổi hẹn</span>
        </button>
        <a
          bannerRight
          routerLink="/explore"
          class="flex h-8 items-center gap-1 rounded-full bg-brand-600 px-2 text-[12px] font-semibold text-white shadow-md shadow-brand-900/30 transition hover:bg-brand-700 sm:px-3"
          aria-label="Khám phá thêm"
        >
          <app-icon name="compass" [size]="14" /><span class="max-sm:hidden">Khám phá thêm</span>
        </a>

        <div class="flex flex-col gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <label class="flex h-11 min-w-0 flex-[1_1_100%] items-center gap-2.5 rounded-full bg-white px-4 text-slate-500 shadow-lg shadow-brand-900/20 sm:max-w-[420px] sm:flex-[1_1_280px]">
              <app-icon name="search" [size]="18" />
              <span class="sr-only">Tìm trong My place</span>
              <input
                type="search"
                [value]="search()"
                (input)="search.set($any($event.target).value)"
                class="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                placeholder="Tìm theo tên, địa chỉ, ghi chú…"
              />
            </label>
            <!-- Điện thoại: giá và sắp xếp gom thành một hàng vuốt ngang -->
            <div class="flex gap-2 max-sm:-mx-4 max-sm:w-[calc(100%+2rem)] max-sm:overflow-x-auto max-sm:px-4 max-sm:[scrollbar-width:none] *:shrink-0 *:whitespace-nowrap sm:flex-wrap">
              <label class="flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm text-slate-700 shadow-lg shadow-brand-900/20">
                <span class="text-brand-600"><app-icon name="wallet" [size]="18" /></span>
                <span class="sr-only">Khoảng giá</span>
                <select [value]="price()" (change)="price.set($any($event.target).value)" class="cursor-pointer bg-transparent text-sm text-slate-900 outline-none">
                  <option value="">Mọi khoảng giá</option>
                  @for (p of priceRanges; track p.value) {
                    <option [value]="p.value">{{ p.label }} ({{ p.hint }})</option>
                  }
                </select>
              </label>
              <label class="flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm text-slate-700 shadow-lg shadow-brand-900/20">
                <span class="text-brand-600"><app-icon name="sort" [size]="18" /></span>
                <span class="sr-only">Sắp xếp</span>
                <select [value]="sortKey()" (change)="sortKey.set($any($event.target).value)" class="cursor-pointer bg-transparent text-sm text-slate-900 outline-none">
                  @for (opt of sortOptions; track opt.key) {
                    <!-- "Gần tôi nhất" cần vị trí: bấm "Tính khoảng cách từ tôi" trước -->
                    <option [value]="opt.key" [disabled]="opt.key === 'distance' && !userLocation()">Sắp xếp: {{ opt.label }}</option>
                  }
                </select>
              </label>
            </div>
          </div>
          <div role="group" aria-label="Loại" class="flex gap-2 max-sm:-mx-4 max-sm:w-[calc(100%+2rem)] max-sm:overflow-x-auto max-sm:px-4 max-sm:[scrollbar-width:none] *:shrink-0 *:whitespace-nowrap sm:flex-wrap">
            @for (t of typeFilters; track t.value) {
              <button
                type="button"
                [attr.aria-pressed]="type() === t.value"
                class="inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[13px] shadow-lg shadow-brand-900/20 transition"
                [class]="type() === t.value
                  ? 'bg-brand-600 font-semibold text-white'
                  : 'bg-white font-medium text-slate-700 hover:bg-brand-50'"
                (click)="pickType(t.value)"
              >
                <app-icon [name]="t.icon" [size]="16" />{{ t.label }} · {{ counts()[t.value || 'all'] }}
              </button>
            }
          </div>
        </div>
      </app-page-banner>
      @if (locationError()) {
        <p class="text-xs text-amber-700">{{ locationError() }}</p>
      }

      <!-- Cầu nối: đã có chỗ ưng ý thì lên plan -->
      <a
        routerLink="/plans"
        class="flex items-center gap-2.5 rounded-xl border border-brand-200 bg-brand-100 px-3.5 py-2 text-[13px] text-slate-700 transition hover:bg-brand-50"
      >
        <span class="text-brand-600"><app-icon name="route" [size]="16" /></span>
        <span class="min-w-0 flex-1 truncate"><b class="text-slate-900">Đã chọn được chỗ?</b><span class="max-sm:hidden"> Ghép quán và chỗ chơi thành lịch trình cho buổi hẹn tới.</span></span>
        <span class="flex shrink-0 items-center gap-1 font-semibold text-brand-800">Lên plan<app-icon name="arrowRight" [size]="14" [stroke]="2.4" /></span>
      </a>

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
        @if (visible().length) {
          <h2 class="mt-2 flex items-baseline gap-2 text-lg font-bold tracking-tight text-slate-900">
            {{ placeTitle() }}<span class="text-sm font-medium text-slate-500">{{ visible().length }} quán</span>
          </h2>
          <!-- Hàng thẻ đầu vừa khít màn hình, hàng sau cuộn mới thấy -->
          <div appFitRow class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
            @for (item of visible(); track item.place.id) {
              <article
                class="flex h-[var(--row-h,420px)] cursor-pointer flex-col overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(48,30,110,0.04),0_8px_24px_rgba(48,30,110,0.05)] transition hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-brand-500"
                tabindex="0"
                role="button"
                [attr.aria-label]="'Xem chi tiết ' + item.place.name"
                (click)="detailing.set(item)"
                (keydown.enter)="detailing.set(item)"
              >
                <div class="relative flex min-h-0 flex-[0_1_75%] items-center justify-center overflow-hidden bg-[#EFEAFC] text-brand-500">
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
                    <div class="flex items-center gap-2">
                      <span class="shrink-0 text-[13px] font-semibold text-slate-700" [attr.aria-label]="'HANOIVIBE chấm ' + item.place.rating + ' trên 5'"><span class="text-[#E29A2D]">★</span> {{ item.place.rating }}</span>
                      <span class="min-w-0 flex-1 truncate text-[13px] text-slate-500">{{ item.place.address || 'Chưa có địa chỉ' }}</span>
                      <span class="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">{{ priceText(item.place.priceRange) }}</span>
                    </div>
                  </div>
                  <!-- Một nút chính (Vào plan); Chỉ đường / Bỏ là icon, rê chuột thì hiện chữ -->
                  <div class="flex items-center gap-1.5" (click)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()">
                    <a [href]="directions(item.place)" target="_blank" rel="noopener" class="group/act flex h-9 items-center rounded-[10px] border border-brand-200 px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-brand-50 focus-visible:bg-brand-50" aria-label="Chỉ đường" title="Chỉ đường">
                      <app-icon name="navigate" [size]="15" /><span class="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover/act:ml-1 group-hover/act:max-w-[120px] group-hover/act:opacity-100 group-focus-visible/act:ml-1 group-focus-visible/act:max-w-[120px] group-focus-visible/act:opacity-100">Chỉ đường</span>
                    </a>
                    <button type="button" class="group/act flex h-9 items-center rounded-[10px] border border-rose-200 px-2.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 focus-visible:bg-rose-50" aria-label="Bỏ khỏi My place" title="Bỏ khỏi My place" (click)="pendingRemove.set(item.place)">
                      <app-icon name="trash" [size]="15" /><span class="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover/act:ml-1 group-hover/act:max-w-[120px] group-hover/act:opacity-100 group-focus-visible/act:ml-1 group-focus-visible/act:max-w-[120px] group-focus-visible/act:opacity-100">Bỏ khỏi My place</span>
                    </button>
                    @if (item.place.catalogId; as catalogId) {
                      <button type="button" class="flex min-h-9 min-w-0 flex-1 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-[10px] bg-brand-600 px-2 text-xs font-semibold text-white hover:bg-brand-700" (click)="planTarget.set({ kind: 'place', refId: catalogId, name: item.place.name, district: null })">
                        <app-icon name="route" [size]="14" [stroke]="2.2" />Vào plan
                      </button>
                    } @else {
                      <!-- Quán tự nhập cũ (không thuộc Khám phá quán): không thêm vào plan được, mở chi tiết -->
                      <button type="button" class="flex min-h-9 min-w-0 flex-1 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-[10px] bg-brand-600 px-2 text-xs font-semibold text-white hover:bg-brand-700" (click)="detailing.set(item)">
                        <app-icon name="eye" [size]="14" />Chi tiết
                      </button>
                    }
                  </div>
                </div>
              </article>
            }
          </div>
        }
        @if (visibleSpots().length) {
          <h2 class="mt-2 flex items-baseline gap-2 text-lg font-bold tracking-tight text-slate-900">
            Chỗ chơi đã lưu<span class="text-sm font-medium text-slate-500">{{ visibleSpots().length }} chỗ</span>
          </h2>
          <div appFitRow class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
            @for (row of visibleSpots(); track row.spot.id) {
              <article
                class="flex h-[var(--row-h,420px)] cursor-pointer flex-col overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(48,30,110,0.04),0_8px_24px_rgba(48,30,110,0.05)] transition hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-brand-500"
                tabindex="0"
                role="button"
                [attr.aria-label]="'Xem chi tiết ' + row.spot.name"
                (click)="spotDetail.set(row.spot)"
                (keydown.enter)="spotDetail.set(row.spot)"
              >
                <div class="relative flex min-h-0 flex-[0_1_75%] items-center justify-center overflow-hidden bg-[#EFEAFC] text-brand-500">
                  @if (row.spot.imageUrl) {
                    <app-photo-carousel class="h-full w-full" [photos]="photosOf(row.spot)" [alt]="row.spot.name" />
                  } @else {
                    <app-icon [name]="spotIcon(row.spot)" [size]="40" [stroke]="1.5" />
                  }
                  <span class="absolute left-3 top-3 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-brand-800" [title]="spotLabel(row.spot)">{{ spotShort(row.spot) }}</span>
                  <span class="absolute right-3 top-3 rounded-full bg-slate-900/70 px-2.5 py-1 text-xs font-medium text-white">
                    {{ row.distanceKm !== null ? distanceText(row.distanceKm) : spotPrice(row.spot) }}
                  </span>
                </div>
                <div class="flex flex-[1_0_25%] flex-col justify-between gap-2 px-3.5 pb-3 pt-2.5">
                  <div class="flex min-w-0 flex-col gap-1">
                    <h2 class="truncate text-base font-bold tracking-tight text-slate-900" [title]="row.spot.name">{{ row.spot.name }}</h2>
                    <div class="flex items-center gap-2">
                      @if (row.spot.ratingCount && row.spot.ratingAvg !== null) {
                        <span class="shrink-0 text-[13px] font-semibold text-slate-700" [attr.aria-label]="'Đánh giá ' + rating(row.spot.ratingAvg) + ' trên 5, ' + row.spot.ratingCount + ' lượt'"><span class="text-[#E29A2D]">★</span> {{ rating(row.spot.ratingAvg) }}</span>
                      }
                      <span class="min-w-0 flex-1 truncate text-[13px] text-slate-500">{{ row.spot.address || 'Chưa có địa chỉ' }} · <span class="font-medium text-slate-600">{{ row.spot.districtLabel }}</span></span>
                      <app-vibe-tags class="shrink-0" [vibes]="row.spot.vibes" />
                    </div>
                  </div>
                  <div class="flex items-center gap-1.5" (click)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()">
                    <a [href]="spotDirections(row.spot)" target="_blank" rel="noopener" class="group/act flex h-9 items-center rounded-[10px] border border-brand-200 px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-brand-50 focus-visible:bg-brand-50" aria-label="Chỉ đường" title="Chỉ đường">
                      <app-icon name="navigate" [size]="15" /><span class="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover/act:ml-1 group-hover/act:max-w-[120px] group-hover/act:opacity-100 group-focus-visible/act:ml-1 group-focus-visible/act:max-w-[120px] group-focus-visible/act:opacity-100">Chỉ đường</span>
                    </a>
                    <button type="button" class="group/act flex h-9 items-center rounded-[10px] border border-rose-200 px-2.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 focus-visible:bg-rose-50" aria-label="Bỏ khỏi My place" title="Bỏ khỏi My place" (click)="pendingRemoveSpot.set(row.spot)">
                      <app-icon name="trash" [size]="15" /><span class="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover/act:ml-1 group-hover/act:max-w-[120px] group-hover/act:opacity-100 group-focus-visible/act:ml-1 group-focus-visible/act:max-w-[120px] group-focus-visible/act:opacity-100">Bỏ khỏi My place</span>
                    </button>
                    <button type="button" class="flex min-h-9 min-w-0 flex-1 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-[10px] bg-brand-600 px-2 text-xs font-semibold text-white hover:bg-brand-700" (click)="planTarget.set({ kind: 'spot', refId: row.spot.id, name: row.spot.name, district: row.spot.district })">
                      <app-icon name="route" [size]="14" [stroke]="2.2" />Vào plan
                    </button>
                  </div>
                </div>
              </article>
            }
          </div>
        }
      }
    </div>

    @if (autoplanOpen()) {
      <app-autoplan-dialog (closed)="autoplanOpen.set(false)" />
    }

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
  protected readonly planTarget = signal<{ kind: StopKind; refId: string; name: string; district: string | null } | null>(null);
  protected readonly autoplanOpen = signal(false);
  protected readonly rating = ratingText;
  protected readonly spotPrice = spotPriceText;

  /** Ảnh nền banner: ảnh nơi đầu tiên đã lưu; chưa lưu gì thì Hồ Gươm đêm. null khi đang tải (tránh nháy) */
  protected readonly defaultBanner = DEFAULT_BANNER;
  protected readonly defaultCredit = DEFAULT_BANNER_CREDIT;
  protected readonly bannerImage = computed(() => {
    if (!this.placeService.loaded()) return null;
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
