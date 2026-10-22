import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { errorCode } from '../../core/api/api';
import { AuthService } from '../../core/auth/auth.service';
import { LoginGate } from '../../core/auth/login-gate.service';
import { ArticleSummary } from '../../core/models/article.model';
import { DistrictOption, FeaturedItem, MY_PLACE_GROUP } from '../../core/models/catalog.model';
import { nowHHmm } from '../../core/models/filters.model';
import {
  imageVariant,
  PLACE_LABELS,
  placePriceText,
  PlaceType,
} from '../../core/models/place.model';
import { ratingText } from '../../core/models/review.model';
import { FeaturedSpot, SPOT_CATEGORIES, spotPriceText } from '../../core/models/spot.model';
import { Vibe } from '../../core/models/vibe.model';
import { SeoService } from '../../core/seo/seo.service';
import { ArticleService } from '../../core/services/article.service';
import { CatalogService } from '../../core/services/catalog.service';
import { HomeStats, HomeStatsService } from '../../core/services/home-stats.service';
import { PlaceService } from '../../core/services/place.service';
import { SavedSpotService } from '../../core/services/saved-spot.service';
import { SpotService } from '../../core/services/spot.service';
import { ToastService } from '../../core/services/toast.service';
import { FeaturedEditorComponent } from '../../shared/ui/featured-editor.component';
import { IconComponent, IconName } from '../../shared/ui/icon.component';
import {
  DEFAULT_BANNER,
  DEFAULT_BANNER_CREDIT,
  DEFAULT_BANNER_SRCSET,
  editableBanner,
  PageBannerComponent,
} from '../../shared/ui/page-banner.component';
import { SiteFooterComponent } from '../../shared/ui/site-footer.component';
import { VibeTagsComponent } from '../../shared/ui/vibe-tags.component';
import { AutoplanDialogComponent } from '../plans/autoplan-dialog.component';

/** Ô "Hẹn kiểu gì?": một kiểu hẹn dẫn tới danh sách đã lọc sẵn */
interface VibeTile {
  vibe: Vibe;
  icon: IconName;
  title: string;
  text: string;
  link: string;
  linkLabel: string;
  tone: string;
}

/** Chip trong banner: loại quán / chỗ chơi kèm số lượng */
interface KindChip {
  key: PlaceType | 'spot';
  icon: IconName;
  label: string;
  link: string;
  query: Record<string, string>;
}

/** Một thẻ trong lưới "Điểm hẹn nổi bật": quán hoặc chỗ chơi, cùng một hình dạng để xếp chung */
interface VenueCard {
  kind: 'place' | 'spot';
  /** Khoá chip lọc: loại quán hoặc 'spot' */
  group: PlaceType | 'spot';
  id: string;
  position: number;
  link: string[];
  imageUrl: string | null;
  badge: string;
  name: string;
  address: string;
  districtLabel: string;
  rating: string | null;
  ratingCount: number;
  price: string;
  note: string;
  vibes: Vibe[];
  saved: boolean;
}

const VIBE_TILES: VibeTile[] = [
  {
    vibe: 'chill',
    icon: 'leaf',
    title: 'Chill',
    text: 'Ngồi lâu, nói chuyện, nhạc nhẹ. Cafe sân vườn, quán ăn ấm cúng.',
    link: '/explore',
    linkLabel: 'Xem quán',
    tone: 'from-emerald-500 to-teal-700',
  },
  {
    vibe: 'active',
    icon: 'zap',
    title: 'Năng động',
    text: 'Cùng làm một thứ: workshop, vận động, chợ đêm, music box.',
    link: '/spots',
    linkLabel: 'Xem chỗ chơi',
    tone: 'from-amber-500 to-orange-600',
  },
  {
    vibe: 'romantic',
    icon: 'heart',
    title: 'Lãng mạn',
    text: 'Bar tầng cao, nhà hàng view đẹp, buổi tối đáng nhớ.',
    link: '/explore',
    linkLabel: 'Xem quán',
    tone: 'from-rose-500 to-pink-700',
  },
];

const KIND_CHIPS: KindChip[] = [
  { key: 'cafe', icon: 'cup', label: 'Quán cafe', link: '/explore', query: { loai: 'cafe' } },
  {
    key: 'restaurant',
    icon: 'utensils',
    label: 'Quán ăn',
    link: '/explore',
    query: { loai: 'restaurant' },
  },
  { key: 'bar', icon: 'cocktail', label: 'Quán bar', link: '/explore', query: { loai: 'bar' } },
  { key: 'spot', icon: 'gate', label: 'Chỗ chơi', link: '/spots', query: {} },
];

/** Chip lọc trên lưới nổi bật */
const GROUP_CHIPS: { value: PlaceType | 'spot' | ''; label: string }[] = [
  { value: '', label: 'Tất cả' },
  { value: 'cafe', label: 'Quán cafe' },
  { value: 'restaurant', label: 'Quán ăn' },
  { value: 'bar', label: 'Quán bar' },
  { value: 'spot', label: 'Chỗ chơi' },
];

/** Số thẻ tối đa trong lưới nổi bật */
const GRID_SIZE = 6;

/**
 * Trang chủ (/): nơi hạ cánh cho mọi người, khách lẫn người đã đăng nhập. Chỉ để duyệt và dẫn đi; danh sách
 * và bộ lọc nằm ở Khám phá quán / Tìm chỗ chơi, mọi ô ở đây dẫn sang đó với bộ lọc đã chọn sẵn trên đường dẫn.
 * Mọi con số đều là số thật từ backend (số quán, chỗ chơi, đánh giá, plan, số chỗ đang mở cửa).
 */
@Component({
  selector: 'app-home-page',
  imports: [
    RouterLink,
    PageBannerComponent,
    FeaturedEditorComponent,
    IconComponent,
    AutoplanDialogComponent,
    VibeTagsComponent,
    SiteFooterComponent,
  ],
  template: `
    <div class="flex flex-col gap-8 px-4 pb-8 pt-4 sm:px-6 lg:px-8 lg:pt-5">
      <!-- Banner: dùng chung ảnh nền với Khám phá quán (admin đổi ở đâu cũng được) -->
      <app-page-banner
        kicker="Hà Nội, hẹn hò"
        heading="Đi đâu cũng vui."
        headingAccent="Hẹn ở đâu cũng đẹp."
        tagline="Quán cafe, quán ăn, bar và chỗ chơi cho buổi hẹn của bạn. Chọn kiểu hẹn, chọn khu vực, hoặc để Autoplan lo."
        [image]="banner.ready() ? (banner.custom() ?? defaultBanner) : null"
        [imageSrcset]="banner.custom() ? null : defaultSrcset"
        [imagePosition]="banner.custom() ? 'center' : '70% 28%'"
        [credit]="banner.custom() ? null : defaultCredit"
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
        <!-- Số chỗ đang mở cửa lúc này (giờ máy người xem) -->
        @if (openNow(); as n) {
          <span
            bannerLeft
            class="flex h-9 items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 text-[13px] font-medium text-white backdrop-blur max-sm:hidden"
          >
            <span class="h-2 w-2 rounded-full bg-emerald-400"></span>{{ n }} chỗ đang mở cửa
          </span>
        }
        <button
          bannerRight
          type="button"
          class="flex h-9 items-center gap-1 rounded-full bg-white px-2 text-[12px] font-semibold text-brand-700 shadow-md shadow-brand-900/20 transition hover:bg-brand-50 sm:px-3"
          aria-label="Autoplan buổi hẹn"
          (click)="autoplanOpen.set(true)"
        >
          <app-icon name="shuffle" [size]="14" /><span class="max-sm:hidden"
            >Autoplan buổi hẹn</span
          >
        </button>

        <!-- Tìm: Enter hoặc bấm nút thì sang Khám phá quán với từ khoá; chip loại kèm số lượng -->
        <form class="flex flex-wrap items-center gap-2" role="search" (submit)="search($event)">
          <label
            class="flex h-11 min-w-0 flex-[1_1_100%] items-center gap-2.5 rounded-full bg-white px-4 text-slate-500 shadow-lg shadow-brand-900/20 sm:max-w-[480px] sm:flex-[1_1_320px]"
          >
            <app-icon name="search" [size]="18" />
            <span class="sr-only">Tìm quán</span>
            <input
              type="search"
              name="q"
              [value]="q()"
              (input)="q.set($any($event.target).value)"
              class="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              placeholder="Tìm quán theo tên, địa chỉ…"
            />
            <button
              type="submit"
              class="-mr-2 flex h-8 items-center rounded-full bg-brand-600 px-3 text-[13px] font-semibold text-white hover:bg-brand-700"
            >
              Tìm
            </button>
          </label>
          <div
            role="group"
            aria-label="Đi đâu"
            class="flex gap-2 max-sm:-mx-4 max-sm:w-[calc(100%+2rem)] max-sm:overflow-x-auto max-sm:px-4 max-sm:[scrollbar-width:none] *:shrink-0 *:whitespace-nowrap sm:contents"
          >
            @for (k of kinds; track k.key) {
              <a
                [routerLink]="k.link"
                [queryParams]="k.query"
                class="flex h-11 items-center gap-2 rounded-full bg-white/15 px-4 text-sm font-medium text-white backdrop-blur transition hover:bg-white/25 sm:bg-white sm:text-slate-700 sm:shadow-lg sm:shadow-brand-900/20 sm:hover:bg-brand-50"
              >
                <span class="text-brand-200 sm:text-brand-600"
                  ><app-icon [name]="k.icon" [size]="17" /></span
                >{{ k.label }}
                @if (kindCount(k.key); as n) {
                  <span
                    class="rounded-full bg-white/20 px-1.5 text-xs font-semibold sm:bg-brand-100 sm:text-brand-800"
                    >{{ n }}</span
                  >
                }
              </a>
            }
          </div>
        </form>
      </app-page-banner>

      <!-- Con số thật: điểm hẹn tuyển chọn, đánh giá, plan -->
      @if (stats(); as s) {
        <section class="-mt-4 grid gap-3 sm:grid-cols-3" aria-label="HANOIVIBE có gì">
          <div
            class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5"
          >
            <span
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700"
              ><app-icon name="pin" [size]="20"
            /></span>
            <span>
              <span class="block text-2xl font-extrabold leading-none text-slate-900">{{
                s.places + s.spots
              }}</span>
              <span class="mt-1 block text-[13px] text-slate-500"
                >điểm hẹn tuyển chọn: {{ s.places }} quán, {{ s.spots }} chỗ chơi</span
              >
            </span>
          </div>
          <div
            class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5"
          >
            <span
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"
              ><app-icon name="star" [size]="20"
            /></span>
            <span>
              @if (s.reviews && s.ratingAvg !== null) {
                <span class="block text-2xl font-extrabold leading-none text-slate-900"
                  >{{ rating(s.ratingAvg)
                  }}<span class="text-base font-semibold text-slate-500">/5</span></span
                >
                <span class="mt-1 block text-[13px] text-slate-500"
                  >từ {{ s.reviews }} đánh giá của người đã đi</span
                >
              } @else {
                <span class="block text-2xl font-extrabold leading-none text-slate-900">★</span>
                <span class="mt-1 block text-[13px] text-slate-500"
                  >Chưa có đánh giá. Đi rồi kể lại nhé!</span
                >
              }
            </span>
          </div>
          <div
            class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5"
          >
            <span
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600"
              ><app-icon name="route" [size]="20"
            /></span>
            <span>
              <span class="block text-2xl font-extrabold leading-none text-slate-900">{{
                s.plans
              }}</span>
              <span class="mt-1 block text-[13px] text-slate-500">plan hẹn hò đã được lập</span>
            </span>
          </div>
        </section>
      }

      <!-- Hẹn kiểu gì: 3 kiểu hẹn (nhãn Autoplan dùng) dẫn tới danh sách đã lọc -->
      <section class="flex flex-col gap-3">
        <h2 class="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
          Tối nay hẹn kiểu gì?
        </h2>
        <div class="grid gap-3 sm:grid-cols-3">
          @for (t of vibes; track t.vibe) {
            <a
              [routerLink]="t.link"
              [queryParams]="{ kieu: t.vibe }"
              class="group relative flex min-h-[150px] flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:min-h-[180px] sm:p-5"
              [class]="t.tone"
            >
              <span class="flex h-10 w-10 items-center justify-center rounded-full bg-white/20"
                ><app-icon [name]="t.icon" [size]="20"
              /></span>
              <span>
                <span class="block text-[22px] font-extrabold leading-tight sm:text-2xl">{{
                  t.title
                }}</span>
                <span class="mt-1 block text-sm text-white/85">{{ t.text }}</span>
                <span class="mt-2.5 inline-flex items-center gap-1 text-[13px] font-semibold"
                  >{{ t.linkLabel }}<app-icon name="arrowRight" [size]="14" [stroke]="2.4"
                /></span>
              </span>
            </a>
          }
        </div>
      </section>

      <!-- Điểm hẹn nổi bật (admin chọn quán và chỗ chơi): lưới thẻ, chip lọc theo nhóm -->
      @if (allCards().length || canEdit()) {
        <section class="flex flex-col gap-3">
          <div class="flex flex-wrap items-center gap-2">
            <div class="mr-auto">
              <p
                class="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.18em] text-brand-600"
              >
                <span class="h-1.5 w-1.5 rounded-full bg-brand-500"></span>Tuyển chọn
              </p>
              <h2 class="mt-1 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
                Điểm hẹn nổi bật
              </h2>
            </div>
            @if (canEdit()) {
              <button
                type="button"
                class="flex min-h-10 items-center gap-1.5 rounded-full border border-brand-200 bg-white px-3.5 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
                (click)="placeEditorOpen.set(true)"
              >
                <app-icon name="edit" [size]="15" />Chọn quán
              </button>
              <button
                type="button"
                class="flex min-h-10 items-center gap-1.5 rounded-full border border-brand-200 bg-white px-3.5 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
                (click)="spotEditorOpen.set(true)"
              >
                <app-icon name="edit" [size]="15" />Chọn chỗ chơi
              </button>
            }
          </div>
          <div
            role="group"
            aria-label="Lọc điểm hẹn nổi bật"
            class="flex gap-2 max-sm:-mx-4 max-sm:w-[calc(100%+2rem)] max-sm:overflow-x-auto max-sm:px-4 max-sm:[scrollbar-width:none] *:shrink-0"
          >
            @for (c of groupChips; track c.value) {
              <button
                type="button"
                class="min-h-9 rounded-full border px-3.5 text-[13px] font-medium transition"
                [class]="
                  group() === c.value
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50'
                "
                [attr.aria-pressed]="group() === c.value"
                (click)="group.set(c.value)"
              >
                {{ c.label }}
              </button>
            }
          </div>

          @if (cards().length) {
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              @for (c of cards(); track c.kind + c.id) {
                <article
                  class="group relative flex flex-col overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
                >
                  <a
                    [routerLink]="c.link"
                    class="relative block aspect-[4/3] overflow-hidden bg-[#EFEAFC]"
                    [attr.aria-label]="'Xem ' + c.name"
                  >
                    @if (c.imageUrl) {
                      <img
                        [src]="imageSrc(c.imageUrl)"
                        alt=""
                        loading="lazy"
                        decoding="async"
                        (error)="imageFailed(c.imageUrl)"
                        class="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                      />
                    } @else {
                      <span class="flex h-full w-full items-center justify-center text-brand-500"
                        ><app-icon name="image" [size]="36" [stroke]="1.5"
                      /></span>
                    }
                    <span
                      class="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-brand-800"
                      >{{ c.badge }}</span
                    >
                  </a>
                  <!-- Lưu: trên ảnh, góc phải (khách bấm thì mời đăng nhập) -->
                  @if (c.saved) {
                    <span
                      class="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-[#C2335F] shadow-sm"
                      title="Đã lưu vào My place"
                      ><app-icon name="heart" [size]="17" [filled]="true"
                    /></span>
                  } @else {
                    <button
                      type="button"
                      class="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-slate-600 shadow-sm transition hover:text-[#C2335F]"
                      [attr.aria-label]="'Lưu ' + c.name + ' vào My place'"
                      title="Lưu vào My place"
                      [disabled]="saving() === c.id"
                      (click)="save(c)"
                    >
                      <app-icon name="heart" [size]="17" />
                    </button>
                  }
                  <div class="flex flex-1 flex-col gap-1.5 px-4 pb-4 pt-3">
                    <a
                      [routerLink]="c.link"
                      class="truncate text-base font-bold tracking-tight text-slate-900 hover:text-brand-700"
                      [title]="c.name"
                      >{{ c.name }}</a
                    >
                    <p class="flex flex-wrap items-center gap-x-2 text-[13px] text-slate-600">
                      @if (c.rating) {
                        <span class="font-semibold text-slate-800"
                          ><span class="text-[#E29A2D]">★</span> {{ c.rating }}
                          <span class="font-normal text-slate-400"
                            >({{ c.ratingCount }})</span
                          ></span
                        >
                      }
                      @if (c.price) {
                        <span class="font-medium text-slate-700">{{ c.price }}</span>
                      }
                    </p>
                    <p class="truncate text-[13px] text-slate-500">
                      <span class="text-slate-400"><app-icon name="pin" [size]="13" /></span>
                      {{ c.address || 'Chưa có địa chỉ' }} ·
                      <span class="font-medium text-slate-600">{{ c.districtLabel }}</span>
                    </p>
                    @if (c.note) {
                      <p class="line-clamp-2 text-sm leading-relaxed text-slate-600">
                        {{ c.note }}
                      </p>
                    }
                    <app-vibe-tags class="mt-auto pt-1" [vibes]="c.vibes" />
                  </div>
                </article>
              }
            </div>
          } @else {
            <p
              class="rounded-2xl border border-dashed border-brand-200 bg-white px-6 py-10 text-center text-sm text-slate-500"
            >
              {{
                allCards().length
                  ? 'Chưa có điểm nổi bật trong nhóm này.'
                  : 'Admin chưa chọn điểm hẹn nổi bật.'
              }}
            </p>
          }
          <div class="flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold text-brand-700">
            <a routerLink="/explore" class="hover:underline">Xem tất cả quán →</a>
            <a routerLink="/spots" class="hover:underline">Xem tất cả chỗ chơi →</a>
          </div>
        </section>
      }

      <!-- Bộ sưu tập: bài Cẩm nang có nhúng quán / chỗ chơi -->
      @if (collections().length) {
        <section class="flex flex-col gap-3">
          <div class="flex items-end justify-between gap-3">
            <div>
              <p
                class="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.18em] text-brand-600"
              >
                <span class="h-1.5 w-1.5 rounded-full bg-brand-500"></span>Cẩm nang
              </p>
              <h2 class="mt-1 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
                Bộ sưu tập cho buổi hẹn
              </h2>
            </div>
            <a
              routerLink="/cam-nang"
              class="shrink-0 text-sm font-semibold text-brand-700 hover:underline"
              >Xem tất cả</a
            >
          </div>
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            @for (a of collections(); track a.id) {
              <a
                [routerLink]="['/cam-nang', a.slug]"
                class="group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-4 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:aspect-[3/4]"
              >
                @if (a.coverUrl) {
                  <img
                    [src]="a.coverUrl"
                    alt=""
                    loading="lazy"
                    decoding="async"
                    class="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                }
                <span
                  class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/5"
                ></span>
                @if (a.venueCount) {
                  <span
                    class="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-brand-800"
                    >{{ a.venueCount }} điểm hẹn</span
                  >
                }
                <span class="relative">
                  <span class="block text-lg font-extrabold leading-tight">{{ a.title }}</span>
                  @if (a.excerpt) {
                    <span class="mt-1 line-clamp-2 block text-[13px] text-white/80">{{
                      a.excerpt
                    }}</span>
                  }
                </span>
              </a>
            }
          </div>
        </section>
      }

      <!-- Khu vực: chỉ khu vực đang có quán, nhiều quán xếp trước -->
      @if (districtTiles().length) {
        <section class="flex flex-col gap-3">
          <div class="flex items-baseline justify-between gap-3">
            <h2 class="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
              Hẹn ở khu nào?
            </h2>
            <a routerLink="/explore" class="text-sm font-semibold text-brand-700 hover:underline"
              >Mọi khu vực</a
            >
          </div>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            @for (d of districtTiles(); track d.code) {
              <a
                routerLink="/explore"
                [queryParams]="{ khuvuc: d.code }"
                class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm transition hover:border-brand-300 hover:bg-brand-50"
              >
                <span
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700"
                  ><app-icon name="pin" [size]="18"
                /></span>
                <span class="min-w-0">
                  <span class="block truncate font-bold text-slate-900">{{ d.label }}</span>
                  <span class="block text-[13px] text-slate-500">{{ d.count }} quán</span>
                </span>
              </a>
            }
          </div>
        </section>
      }

      <!-- Hẹn hò: Tìm đối tượng (khối lớn, không hiện hồ sơ người dùng ra ngoài), Autoplan và quiz bên cạnh -->
      <section class="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
        <div
          class="flex flex-col gap-4 rounded-[22px] border border-rose-200 bg-rose-50 p-5 sm:p-6"
        >
          <p
            class="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.18em] text-rose-600"
          >
            <span class="h-1.5 w-1.5 rounded-full bg-rose-500"></span>Tìm đối tượng
          </p>
          <h2 class="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
            Gặp người cùng gu, hẹn ở quán cả hai cùng thích.
          </h2>
          <ul class="grid gap-2 text-sm text-slate-700 sm:grid-cols-3">
            <li class="flex items-start gap-2">
              <span class="mt-0.5 text-rose-600"><app-icon name="checkCircle" [size]="16" /></span
              >Quẹt theo quán và chỗ chơi mà cả hai đã lưu
            </li>
            <li class="flex items-start gap-2">
              <span class="mt-0.5 text-rose-600"><app-icon name="checkCircle" [size]="16" /></span
              >Lọc theo giới tính, tuổi, cùng thành phố
            </li>
            <li class="flex items-start gap-2">
              <span class="mt-0.5 text-rose-600"><app-icon name="checkCircle" [size]="16" /></span
              >Match là nhắn tin ngay, gợi ý điểm hẹn sẵn
            </li>
          </ul>
          <a
            routerLink="/dating"
            class="flex w-fit min-h-11 items-center gap-2 rounded-full bg-[#C2335F] px-5 text-sm font-semibold text-white transition hover:bg-rose-700"
          >
            <app-icon name="heart" [size]="16" [filled]="true" />Tìm người đi cùng<app-icon
              name="arrowRight"
              [size]="15"
              [stroke]="2.4"
            />
          </a>
        </div>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <button
            type="button"
            class="flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-100 p-4 text-left transition hover:bg-brand-50"
            (click)="autoplanOpen.set(true)"
          >
            <span
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-brand-600 shadow-sm"
              ><app-icon name="shuffle" [size]="20"
            /></span>
            <span>
              <span class="block font-bold text-slate-900">Autoplan buổi hẹn</span>
              <span class="mt-0.5 block text-sm text-slate-600"
                >Chọn khu vực và kiểu hẹn, app dựng sẵn lịch trình: quán, chỗ chơi, giờ đi.</span
              >
            </span>
          </button>
          <a
            routerLink="/quiz"
            class="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 transition hover:bg-amber-100/70"
          >
            <span
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-amber-600 shadow-sm"
              ><app-icon name="smile" [size]="20"
            /></span>
            <span>
              <span class="block font-bold text-slate-900">Gu hẹn hò của bạn</span>
              <span class="mt-0.5 block text-sm text-slate-600"
                >Vài câu hỏi ngắn, ra kiểu hẹn hợp gu và quán gợi ý.</span
              >
            </span>
          </a>
        </div>
      </section>

      <!-- Dải kêu gọi cuối trang -->
      <section
        class="relative overflow-hidden rounded-[22px] bg-[#3b2a7a] px-5 py-7 text-white sm:px-8 sm:py-9"
      >
        <div
          class="absolute inset-0 bg-gradient-to-r from-[#2d1f66] via-[#4b33b0] to-[#7a5be3]"
        ></div>
        <div class="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div class="max-w-xl">
            <p
              class="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-white/80"
            >
              <span class="h-px w-7 bg-white/60"></span>Hẹn ở đâu cũng đẹp
            </p>
            <h2 class="mt-2 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
              Sẵn sàng cho buổi hẹn đáng nhớ tiếp theo?
            </h2>
            <p class="mt-2 text-[15px] text-white/85">
              @if (auth.isLoggedIn()) {
                Lưu quán ưng ý vào My place, lập plan cho cuối tuần, hoặc để Autoplan chọn giúp.
              } @else {
                Tạo tài khoản miễn phí để lưu quán, lập plan và tìm người đi cùng.
              }
            </p>
          </div>
          <div class="flex flex-wrap gap-2.5">
            @if (auth.isLoggedIn()) {
              <button
                type="button"
                class="flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-brand-700 shadow-md transition hover:bg-brand-50"
                (click)="autoplanOpen.set(true)"
              >
                <app-icon name="shuffle" [size]="16" />Lập plan ngay
              </button>
            } @else {
              <a
                routerLink="/register"
                class="flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-brand-700 shadow-md transition hover:bg-brand-50"
                >Tạo tài khoản</a
              >
            }
            <a
              routerLink="/explore"
              class="flex min-h-11 items-center gap-2 rounded-full border border-white/40 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              Khám phá {{ stats()?.places ?? '' }} quán<app-icon
                name="arrowRight"
                [size]="15"
                [stroke]="2.4"
              />
            </a>
          </div>
        </div>
      </section>

      <app-site-footer />
    </div>

    @if (placeEditorOpen()) {
      <app-featured-editor
        kind="place"
        [current]="placeSlots()"
        (closed)="placeEditorOpen.set(false)"
        (saved)="loadFeaturedPlaces(); placeEditorOpen.set(false)"
      />
    }
    @if (spotEditorOpen()) {
      <app-featured-editor
        kind="spot"
        [current]="spotSlots()"
        (closed)="spotEditorOpen.set(false)"
        (saved)="loadFeaturedSpots(); spotEditorOpen.set(false)"
      />
    }
    @if (autoplanOpen()) {
      <app-autoplan-dialog (closed)="autoplanOpen.set(false)" />
    }
  `,
})
export class HomePage implements OnInit, OnDestroy {
  private readonly catalog = inject(CatalogService);
  private readonly spots = inject(SpotService);
  private readonly articleApi = inject(ArticleService);
  private readonly statsApi = inject(HomeStatsService);
  private readonly seo = inject(SeoService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly gate = inject(LoginGate);
  private readonly placeService = inject(PlaceService);
  private readonly savedSpots = inject(SavedSpotService);
  protected readonly auth = inject(AuthService);
  protected readonly canEdit = this.auth.canEdit;

  protected readonly vibes = VIBE_TILES;
  protected readonly kinds = KIND_CHIPS;
  protected readonly groupChips = GROUP_CHIPS;
  protected readonly rating = ratingText;

  protected readonly q = signal('');
  protected readonly autoplanOpen = signal(false);

  /** Ảnh nền: cùng ảnh với Khám phá quán */
  protected readonly banner = editableBanner('explore');
  protected readonly defaultBanner = DEFAULT_BANNER;
  protected readonly defaultSrcset = DEFAULT_BANNER_SRCSET;
  protected readonly defaultCredit = DEFAULT_BANNER_CREDIT;

  /** Số quán theo loại và số chỗ chơi (chip trong banner) */
  private readonly placeCounts = signal<Record<string, number> | null>(null);
  private readonly spotCount = signal<number | null>(null);
  /** Số quán + chỗ chơi đang mở cửa lúc này; 0 / chưa biết thì ẩn */
  protected readonly openNow = signal(0);
  protected readonly stats = signal<HomeStats | null>(null);

  private readonly districts = signal<DistrictOption[]>([]);
  protected readonly districtTiles = computed(() =>
    this.districts()
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count),
  );

  /** Bộ sưu tập: bài có nhúng quán xếp trước, tối đa 4 */
  private readonly articles = signal<ArticleSummary[]>([]);
  protected readonly collections = computed(() =>
    [...this.articles()].sort((a, b) => b.venueCount - a.venueCount).slice(0, 4),
  );

  private readonly featuredPlaces = signal<FeaturedItem[]>([]);
  private readonly featuredSpots = signal<FeaturedSpot[]>([]);
  protected readonly placeEditorOpen = signal(false);
  protected readonly spotEditorOpen = signal(false);
  protected readonly placeSlots = computed(() =>
    this.featuredPlaces().map((f) => ({ id: f.place.id, kicker: f.kicker, headline: f.headline })),
  );
  protected readonly spotSlots = computed(() =>
    this.featuredSpots().map((f) => ({ id: f.spot.id, kicker: f.kicker, headline: f.headline })),
  );

  /** Chip đang chọn trên lưới nổi bật ('' = tất cả) */
  protected readonly group = signal<PlaceType | 'spot' | ''>('');
  /** id đang lưu vào My place */
  protected readonly saving = signal<string | null>(null);
  /** Ảnh bản thu nhỏ bị lỗi: quay về ảnh gốc */
  private readonly failedImages = signal<Set<string>>(new Set());

  /** Quán và chỗ chơi nổi bật trộn theo vị trí admin xếp (quán rồi chỗ chơi xen kẽ) */
  protected readonly allCards = computed<VenueCard[]>(() => {
    const places = this.featuredPlaces().map((f) => this.placeCard(f));
    const spots = this.featuredSpots().map((f) => this.spotCard(f));
    const out: VenueCard[] = [];
    for (let i = 0; i < Math.max(places.length, spots.length); i++) {
      if (places[i]) out.push(places[i]);
      if (spots[i]) out.push(spots[i]);
    }
    return out;
  });
  protected readonly cards = computed(() => {
    const g = this.group();
    return this.allCards()
      .filter((c) => !g || c.group === g)
      .slice(0, GRID_SIZE);
  });

  ngOnInit(): void {
    this.seo.set({
      title: 'HANOIVIBE: Hẹn ở đâu cũng đẹp',
      description:
        'Tìm quán cafe, quán ăn, bar và chỗ chơi hẹn hò ở Hà Nội theo kiểu hẹn, khu vực và giá. Autoplan dựng sẵn lịch trình, Cẩm nang gợi ý đi đâu.',
      path: '/',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'HANOIVIBE',
        url: this.seo.absolute('/'),
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: this.seo.absolute('/explore?q={q}') },
          'query-input': 'required name=q',
        },
      },
    });
    this.banner.load();
    this.loadFeaturedPlaces();
    this.loadFeaturedSpots();
    const now = nowHHmm();
    void this.catalog
      .counts({})
      .then((c) => this.placeCounts.set(c))
      .catch(() => undefined);
    void this.spots
      .counts({})
      .then((c) => this.spotCount.set(c['all'] ?? 0))
      .catch(() => undefined);
    void Promise.all([this.catalog.counts({ openAt: now }), this.spots.counts({ openAt: now })])
      .then(([p, s]) => this.openNow.set((p.all ?? 0) + (s['all'] ?? 0)))
      .catch(() => undefined);
    void this.statsApi
      .get()
      .then((s) => this.stats.set(s))
      .catch(() => undefined);
    void this.catalog
      .districts()
      .then((d) => this.districts.set(d))
      .catch(() => undefined);
    void this.articleApi
      .list(0, 8)
      .then((r) => this.articles.set(r.items))
      .catch(() => undefined);
  }

  ngOnDestroy(): void {
    this.seo.clear();
  }

  protected kindCount(key: PlaceType | 'spot'): number | null {
    return key === 'spot' ? this.spotCount() : (this.placeCounts()?.[key] ?? null);
  }

  protected loadFeaturedPlaces(): void {
    void this.catalog
      .featured()
      .then((f) => this.featuredPlaces.set(f))
      .catch(() => undefined);
  }

  protected loadFeaturedSpots(): void {
    void this.spots
      .featured()
      .then((f) => this.featuredSpots.set(f))
      .catch(() => undefined);
  }

  /** Ảnh thẻ: bản 800px nếu là ảnh app tải lên (và chưa lỗi), không thì ảnh gốc */
  protected imageSrc(url: string): string {
    return this.failedImages().has(url) ? url : (imageVariant(url, 800) ?? url);
  }

  protected imageFailed(url: string): void {
    if (!this.failedImages().has(url)) this.failedImages.update((s) => new Set(s).add(url));
  }

  /** Lưu vào My place (quán) hoặc chỗ chơi đã lưu; khách thì mời đăng nhập rồi làm tiếp */
  protected async save(card: VenueCard): Promise<void> {
    if (
      !this.gate.check(
        card.kind === 'place' ? 'lưu quán vào My place' : 'lưu chỗ chơi vào My place',
        () => this.save(card),
      )
    )
      return;
    this.saving.set(card.id);
    try {
      if (card.kind === 'place') {
        const item = this.featuredPlaces().find((f) => f.place.id === card.id)?.place;
        await this.catalog.addToMyPlace(card.id);
        this.markPlaceSaved(card.id);
        this.toast.success(`Đã được add vào ${item ? MY_PLACE_GROUP[item.type] : 'My place'}.`);
        void this.placeService.load();
      } else {
        const spot = this.featuredSpots().find((f) => f.spot.id === card.id)?.spot;
        if (!spot) return;
        await this.savedSpots.save(spot);
        this.featuredSpots.update((l) =>
          l.map((f) =>
            f.spot.id === card.id ? { ...f, spot: { ...f.spot, inMyPlace: true } } : f,
          ),
        );
        this.toast.success('Đã lưu chỗ chơi vào My place.');
      }
    } catch (err) {
      if (errorCode(err) === 'ALREADY_IN_MY_PLACE') {
        this.markPlaceSaved(card.id);
        this.toast.success('Quán này đã có trong My place.');
      }
      // Lỗi khác: errorInterceptor đã hiện thông báo
    } finally {
      this.saving.set(null);
    }
  }

  protected search(event: Event): void {
    event.preventDefault();
    const q = this.q().trim();
    void this.router.navigate(['/explore'], { queryParams: q ? { q } : {} });
  }

  protected cityHint(): void {
    this.toast.show('Sắp có thêm thành phố khác. Hiện HANOIVIBE dành cho Hà Nội.', 'info');
  }

  private markPlaceSaved(id: string): void {
    this.featuredPlaces.update((l) =>
      l.map((f) => (f.place.id === id ? { ...f, place: { ...f.place, inMyPlace: true } } : f)),
    );
  }

  private placeCard(f: FeaturedItem): VenueCard {
    const p = f.place;
    return {
      kind: 'place',
      group: p.type,
      id: p.id,
      position: f.position,
      link: ['/quan', p.slug],
      imageUrl: p.imageUrl || null,
      badge: PLACE_LABELS[p.type].replace(/^quán /, 'Quán '),
      name: p.name,
      address: p.address,
      districtLabel: p.districtLabel,
      rating: p.ratingCount && p.ratingAvg !== null ? ratingText(p.ratingAvg) : null,
      ratingCount: p.ratingCount,
      price: placePriceText(p),
      note: f.headline || p.note,
      vibes: p.vibes,
      saved: p.inMyPlace,
    };
  }

  private spotCard(f: FeaturedSpot): VenueCard {
    const s = f.spot;
    return {
      kind: 'spot',
      group: 'spot',
      id: s.id,
      position: f.position,
      link: ['/cho-choi', s.slug],
      imageUrl: s.imageUrl || null,
      badge: SPOT_CATEGORIES.find((c) => c.value === s.category)?.short ?? s.category,
      name: s.name,
      address: s.address,
      districtLabel: s.districtLabel,
      rating: s.ratingCount && s.ratingAvg !== null ? ratingText(s.ratingAvg) : null,
      ratingCount: s.ratingCount,
      price: spotPriceText(s),
      note: f.headline || s.description,
      vibes: s.vibes,
      saved: s.inMyPlace,
    };
  }
}
