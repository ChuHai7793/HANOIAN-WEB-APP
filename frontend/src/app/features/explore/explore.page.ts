import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { errorCode, problemOf } from '../../core/api/api';
import { AuthService } from '../../core/auth/auth.service';
import { CatalogItem, FeaturedItem, DistrictOption, MY_PLACE_GROUP, TypeCounts } from '../../core/models/catalog.model';
import { Place, PlaceType, priceLabel } from '../../core/models/place.model';
import { CatalogRequest, CatalogService } from '../../core/services/catalog.service';
import { PlaceService } from '../../core/services/place.service';
import { ToastService } from '../../core/services/toast.service';
import { directionsUrl, viewOnMapUrl } from '../../core/utils/gmap-url';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog.component';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
import { FeaturedCard, FeaturedSectionComponent } from '../../shared/ui/featured-section.component';
import { FeaturedEditorComponent } from '../../shared/ui/featured-editor.component';
import { DEFAULT_BANNER, DEFAULT_BANNER_CREDIT, editableBanner, PageBannerComponent } from '../../shared/ui/page-banner.component';

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
  imports: [PageBannerComponent, FeaturedEditorComponent, FeaturedSectionComponent, DetailModalComponent, ReviewsComponent, AutoplanDialogComponent, PhotoCarouselComponent, FitRowDirective, AddToPlanDialogComponent, VibeTagsComponent, PlaceFormComponent, ConfirmDialogComponent, IconComponent, RouterLink],
  template: `
    <div class="flex flex-col gap-3 px-4 pb-10 pt-4 sm:px-6 lg:px-8 lg:pt-5">
      <!-- Banner đầu trang: ảnh nền (admin đổi được, mặc định Hồ Gươm đêm) + lớp phủ tím, chữ giới thiệu và bộ lọc -->
      <!-- Ảnh mặc định: Tháp Rùa nằm ở nửa trên bên phải, nên canh ảnh lệch lên để không bị cắt mất tháp -->
      <app-page-banner
        kicker="Hà Nội, những điểm hẹn"
        heading="Khám phá quán."
        tagline="Một góc thật xinh. Một câu chuyện mới. Một cuộc hẹn đáng nhớ."
        [image]="banner.ready() ? (banner.custom() ?? defaultBanner) : null"
        [imagePosition]="banner.custom() ? 'center' : '70% 28%'"
        [credit]="banner.ready() && !banner.custom() ? defaultCredit : null"
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
          class="flex h-8 items-center gap-1 rounded-full bg-white px-2 text-[12px] font-semibold text-brand-700 shadow-md shadow-brand-900/20 transition hover:bg-brand-50 sm:px-3"
          aria-label="Autoplan buổi hẹn"
          (click)="autoplanOpen.set(true)"
        >
          <app-icon name="shuffle" [size]="14" /><span class="max-sm:hidden">Autoplan buổi hẹn</span>
        </button>
        @if (canEdit()) {
          <div bannerRight class="relative">
            <button
              type="button"
              class="flex h-8 items-center gap-1 rounded-full bg-brand-600 px-2 text-[12px] font-semibold text-white shadow-md shadow-brand-900/30 transition hover:bg-brand-700 sm:px-3" aria-label="Thêm quán"
              (click)="typeMenuOpen.set(!typeMenuOpen())"
            >
              <app-icon name="plus" [size]="14" [stroke]="2.4" />
              <span class="max-sm:hidden">Thêm quán</span>
            </button>
            @if (typeMenuOpen()) {
              <div class="absolute right-0 z-30 mt-1 w-44 text-slate-700 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
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

        <div class="flex flex-wrap items-center gap-2">
          <label class="flex h-11 min-w-0 flex-[1_1_100%] items-center gap-2.5 rounded-full bg-white px-4 text-slate-500 shadow-lg shadow-brand-900/20 sm:max-w-[420px] sm:flex-[1_1_280px]">
            <app-icon name="search" [size]="18" />
            <span class="sr-only">Tìm quán</span>
            <input
              type="search"
              [value]="q()"
              (input)="onSearch($any($event.target).value)"
              class="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              placeholder="Tìm theo tên, địa chỉ…"
            />
          </label>
          <label class="flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm text-slate-700 shadow-lg shadow-brand-900/20">
            <span class="text-brand-600"><app-icon name="pin" [size]="18" /></span>
            <span class="sr-only">Khu vực</span>
            <select
              [value]="district()"
              (change)="district.set($any($event.target).value); reload()"
              class="cursor-pointer bg-transparent text-sm text-slate-900 outline-none"
            >
              <option value="">Mọi khu vực</option>
              @for (d of districts(); track d.code) {
                <option [value]="d.code">{{ d.label }}</option>
              }
            </select>
          </label>
          <div role="group" aria-label="Loại quán" class="flex gap-2 max-sm:-mx-4 max-sm:w-[calc(100%+2rem)] max-sm:overflow-x-auto max-sm:px-4 max-sm:[scrollbar-width:none] *:shrink-0 *:whitespace-nowrap sm:flex-wrap">
            @for (t of typeFilters; track t.value) {
              <button
                type="button"
                [attr.aria-pressed]="type() === t.value"
                class="inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[13px] shadow-lg shadow-brand-900/20 transition"
                [class]="type() === t.value
                  ? 'bg-brand-600 font-semibold text-white'
                  : 'bg-white font-medium text-slate-700 hover:bg-brand-50'"
                (click)="type.set(t.value); reload(false)"
              >
                <app-icon [name]="t.icon" [size]="16" />
                {{ t.label }} · {{ counts()?.[t.value || 'all'] ?? '–' }}
              </button>
            }
          </div>
        </div>
      </app-page-banner>

      <!-- Điểm hẹn nổi bật (admin chọn): ẩn / hiện, nhớ theo trình duyệt -->
      <app-featured-section
        heading="Điểm hẹn nổi bật"
        storageKey="gfm.featuredHidden"
        [cards]="featuredCards()"
        [canEdit]="canEdit()"
        (open)="openFeatured($event)"
        (edit)="featuredEditorOpen.set(true)"
      />

      <!-- Cầu nối: có quán ưng ý thì đi tìm người hẹn -->
      <a
        routerLink="/dating"
        class="flex items-center gap-2.5 rounded-xl border border-brand-200 bg-brand-100 px-3.5 py-2 text-[13px] text-slate-700 transition hover:bg-brand-50"
      >
        <span class="text-brand-600"><app-icon name="heart" [size]="16" /></span>
        <span class="min-w-0 flex-1 truncate"><b class="text-slate-900">Đã có quán ưng ý?</b><span class="max-sm:hidden"> Bật Tìm đối tượng, quẹt và match rồi hẹn nhau ở quán bạn thích.</span></span>
        <span class="flex shrink-0 items-center gap-1 font-semibold text-brand-800">Tìm người đi cùng<app-icon name="arrowRight" [size]="14" [stroke]="2.4" /></span>
      </a>

      @if (loading() && items().length === 0) {
        <p class="text-sm text-slate-500">Đang tải…</p>
      } @else if (items().length === 0) {
        <div class="rounded-[20px] border border-dashed border-brand-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          {{ q() || type() || district() ? 'Không tìm thấy quán phù hợp. Thử từ khoá khác nhé.' : 'Chưa có quán nào trong danh mục.' }}
        </div>
      } @else {
        <h2 class="mt-2 flex items-baseline gap-2 text-lg font-bold tracking-tight text-slate-900">
          {{ type() ? typeTitle() : 'Tất cả quán' }}<span class="text-sm font-medium text-slate-500">{{ total() }} quán</span>
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
                  <app-photo-carousel class="h-full w-full" [photos]="photosOf(item)" [alt]="item.name" />
                } @else {
                  <app-icon [name]="typeIcons[item.type]" [size]="40" [stroke]="1.5" />
                }
                <span class="absolute left-3 top-3 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-brand-800">
                  {{ typeLabels[item.type] }}
                </span>
                @if (item.fans) {
                  <span class="absolute right-3 top-3 rounded-full bg-slate-900/70 px-2.5 py-1 text-xs font-medium text-white">
                    {{ item.fans }} người hợp gu đã lưu
                  </span>
                }
                @if (canEdit()) {
                  <div class="absolute bottom-3 right-3 flex gap-1.5" (click)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()">
                    <button type="button" class="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm text-slate-600 hover:text-brand-700" title="Sửa" (click)="openEdit(item)"><app-icon name="edit" [size]="14" /></button>
                    <button type="button" class="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm text-rose-600 hover:text-rose-700" title="Xoá" (click)="pendingDelete.set(item)"><app-icon name="trash" [size]="14" /></button>
                  </div>
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
                  <a [href]="directions(item)" target="_blank" rel="noopener" class="group/act flex h-9 items-center rounded-[10px] border border-brand-200 px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-brand-50 focus-visible:bg-brand-50" aria-label="Chỉ đường" title="Chỉ đường">
                    <app-icon name="navigate" [size]="15" /><span class="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover/act:ml-1 group-hover/act:max-w-[80px] group-hover/act:opacity-100 group-focus-visible/act:ml-1 group-focus-visible/act:max-w-[80px] group-focus-visible/act:opacity-100">Chỉ đường</span>
                  </a>
                  <button type="button" class="group/act flex h-9 items-center rounded-[10px] border border-brand-200 px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-brand-50 focus-visible:bg-brand-50" aria-label="Vào plan" title="Vào plan" (click)="addToPlan({ kind: 'place', refId: item.id, name: item.name, district: item.district })">
                    <app-icon name="route" [size]="15" /><span class="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover/act:ml-1 group-hover/act:max-w-[80px] group-hover/act:opacity-100 group-focus-visible/act:ml-1 group-focus-visible/act:max-w-[80px] group-focus-visible/act:opacity-100">Vào plan</span>
                  </button>
                  @if (item.inMyPlace) {
                    <span class="flex min-h-9 min-w-0 flex-1 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-[10px] bg-brand-100 px-2 text-xs font-semibold text-brand-800">
                      <app-icon name="heart" [size]="14" [filled]="true" />Đã lưu
                    </span>
                  } @else {
                    <button
                      type="button"
                      class="flex min-h-9 min-w-0 flex-1 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-[10px] bg-brand-600 px-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                      [disabled]="adding() === item.id"
                      (click)="addToMyPlace(item)"
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

    @if (formType(); as type) {
      <app-place-form
        [config]="configs[type]"
        [place]="editing()"
        [districts]="districts()"
        [vibes]="editing()?.vibes ?? null"
        [vibesSource]="editing()?.vibesSource ?? null"
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

    @if (planTarget(); as t) {
      <app-add-to-plan-dialog [kind]="t.kind" [refId]="t.refId" [name]="t.name" [district]="t.district" (closed)="planTarget.set(null)" />
    }

    @if (detail(); as d) {
      <app-detail-modal [title]="d.name" [subtitle]="typeLabels[d.type] + ' · ' + d.districtLabel" [photos]="photosOf(d)" (dismiss)="detail.set(null)">
        <div class="flex flex-col gap-4">
          <p class="flex items-start gap-1.5 text-sm text-slate-600">
            <span class="mt-0.5 text-slate-400"><app-icon name="pin" [size]="15" /></span>{{ d.address || 'Chưa có địa chỉ' }}
          </p>
          <app-vibe-tags [vibes]="d.vibes" />
          <dl class="grid grid-cols-2 gap-3 rounded-xl bg-brand-50/60 p-3 text-sm">
            <div>
              <dt class="text-xs text-slate-500">HANOIVIBE chấm</dt>
              <dd class="flex items-center gap-1 font-semibold text-slate-900">
                <span class="tracking-[1px] text-[#E29A2D]" aria-hidden="true">{{ stars(d.rating).on }}</span><span class="tracking-[1px] text-[#D9D3EA]" aria-hidden="true">{{ stars(d.rating).off }}</span>{{ d.rating }}.0
              </dd>
            </div>
            <div>
              <dt class="text-xs text-slate-500">Mức giá</dt>
              <dd class="font-semibold text-slate-900">{{ priceText(d) }}</dd>
            </div>
            <div>
              <dt class="text-xs text-slate-500">Giờ mở cửa</dt>
              <dd class="font-semibold text-slate-900">{{ d.openTime }}–{{ d.closeTime }}</dd>
            </div>
            <div>
              <dt class="text-xs text-slate-500">{{ d.type === 'restaurant' ? 'Món' : 'Tiện ích' }}</dt>
              <dd class="font-semibold text-slate-900">
                @if (d.type === 'restaurant') {
                  {{ d.cuisine || '—' }}
                } @else {
                  {{ amenities(d) }}
                }
              </dd>
            </div>
          </dl>
          @if (d.note) {
            <p class="whitespace-pre-line text-sm leading-relaxed text-slate-700">{{ d.note }}</p>
          }
          @if (d.fans) {
            <p class="flex items-center gap-1.5 text-[13px] text-brand-700"><app-icon name="heart" [size]="14" />{{ d.fans }} người hợp gu đã lưu quán này</p>
          }
          <app-reviews target="place" [targetId]="d.id" (summaryChange)="onRatingChange(d.id, $event)" />
        </div>
        <div modalFooter class="flex flex-wrap justify-end gap-2">
          <a [routerLink]="['/quan', d.slug]" class="mr-auto flex min-h-10 items-center gap-1 text-[13px] font-semibold text-brand-700 hover:underline">Xem trang quán<app-icon name="arrowRight" [size]="14" [stroke]="2.4" /></a>
          <a [href]="mapUrl(d)" target="_blank" rel="noopener" class="flex min-h-10 items-center gap-1.5 rounded-[10px] border border-brand-200 px-3 text-[13px] font-medium text-slate-700 hover:bg-brand-50">
            <app-icon name="pin" [size]="15" />Maps
          </a>
          <a [href]="directions(d)" target="_blank" rel="noopener" class="flex min-h-10 items-center gap-1.5 rounded-[10px] border border-brand-200 px-3 text-[13px] font-medium text-slate-700 hover:bg-brand-50">
            <app-icon name="navigate" [size]="15" />Chỉ đường
          </a>
          <button
            type="button"
            class="flex min-h-10 items-center gap-1.5 rounded-[10px] border border-brand-200 px-3 text-[13px] font-medium text-slate-700 hover:bg-brand-50"
            (click)="detail.set(null); addToPlan({ kind: 'place', refId: d.id, name: d.name, district: d.district })"
          >
            <app-icon name="route" [size]="15" />Vào plan
          </button>
          @if (!d.inMyPlace) {
            <button
              type="button"
              class="flex min-h-10 items-center gap-1.5 rounded-[10px] bg-brand-600 px-3.5 text-[13px] font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              [disabled]="adding() === d.id"
              (click)="addToMyPlace(d); detail.set(null)"
            >
              <app-icon name="plus" [size]="15" [stroke]="2.4" />Lưu vào My place
            </button>
          }
        </div>
      </app-detail-modal>
    }

    @if (featuredEditorOpen()) {
      <app-featured-editor kind="place" [current]="featuredSlots()" (closed)="featuredEditorOpen.set(false)" (saved)="reloadFeatured(); featuredEditorOpen.set(false)" />
    }

    @if (autoplanOpen()) {
      <app-autoplan-dialog (closed)="autoplanOpen.set(false)" />
    }
  `,
})
export class ExplorePage implements OnInit {
  private readonly gate = inject(LoginGate);
  protected readonly autoplanOpen = signal(false);
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
  protected readonly defaultCredit = DEFAULT_BANNER_CREDIT;

  protected cityHint(): void {
    this.toast.show('Sắp có thêm thành phố khác. Hiện HANOIVIBE dành cho Hà Nội.', 'info');
  }


  /** Tiêu đề khu danh sách theo chip loại quán đang chọn */
  protected typeTitle(): string {
    return this.typeFilters.find((t) => t.value === this.type())?.label ?? 'Tất cả quán';
  }

  /** Điểm hẹn nổi bật (admin chọn) */
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

  private page = 0;
  private searchTimer?: ReturnType<typeof setTimeout>;
  /** Bỏ kết quả của lần tải cũ nếu người dùng đã đổi bộ lọc */
  private requestSeq = 0;

  private readonly route = inject(ActivatedRoute);

  async ngOnInit(): Promise<void> {
    void this.catalog.districts().then((d) => this.districts.set(d));
    this.reloadFeatured();
    this.banner.load();
    // Mở từ "Gợi ý điểm hẹn" của Tìm đối tượng: /explore?q=<tên quán>
    this.q.set(this.route.snapshot.queryParamMap.get('q') ?? '');
    await this.reload();
  }

  protected onSearch(value: string): void {
    this.q.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.reload(), 300);
  }

  /** {@code withCounts}: tính lại số trên chip (đổi loại thì không cần, số không theo loại). */
  protected async reload(withCounts = true): Promise<void> {
    this.page = 0;
    if (withCounts) {
      const filter = { q: this.q().trim(), district: this.district() };
      void this.catalog.counts(filter).then((c) => {
        // Bỏ kết quả cũ nếu bộ lọc đã đổi trong lúc chờ
        if (filter.q === this.q().trim() && filter.district === this.district()) this.counts.set(c);
      });
    }
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

  /** 4 → { on: '★★★★', off: '★' } */
  protected stars(rating: number): { on: string; off: string } {
    return { on: '★'.repeat(rating), off: '★'.repeat(5 - rating) };
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
