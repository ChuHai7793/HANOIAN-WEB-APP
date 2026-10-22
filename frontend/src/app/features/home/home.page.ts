import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { DistrictOption, FeaturedItem } from '../../core/models/catalog.model';
import { imageVariant, PLACE_LABELS, PlaceType } from '../../core/models/place.model';
import { FeaturedSpot, SPOT_CATEGORIES } from '../../core/models/spot.model';
import { Vibe } from '../../core/models/vibe.model';
import { SeoService } from '../../core/seo/seo.service';
import { CatalogService } from '../../core/services/catalog.service';
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
import { ScrollRowComponent } from '../../shared/ui/scroll-row.component';
import { SiteFooterComponent } from '../../shared/ui/site-footer.component';
import { AutoplanDialogComponent } from '../plans/autoplan-dialog.component';

/** Ô ảnh "Hẹn kiểu gì?": kiểu hẹn hoặc loại quán, dẫn tới danh sách đã lọc sẵn */
interface PurposeTile {
  key: string;
  icon: IconName;
  title: string;
  link: string;
  query: Record<string, string>;
  /** Nền khi chưa có ảnh */
  tone: string;
  /** Lấy ảnh quán tiêu biểu của nhóm này ở đâu */
  source: { kind: 'place'; vibe?: Vibe; type?: PlaceType } | { kind: 'spot'; vibe?: Vibe };
}

/** Một thẻ trong lưới "Điểm hẹn nổi bật": quán hoặc chỗ chơi, cùng một hình dạng để xếp chung */
interface VenueCard {
  key: string;
  link: string[];
  imageUrl: string | null;
  badge: string;
  name: string;
  address: string;
}

const PURPOSE_TILES: PurposeTile[] = [
  {
    key: 'chill',
    icon: 'leaf',
    title: 'Chill',
    link: '/explore',
    query: { kieu: 'chill' },
    tone: 'from-emerald-600 to-teal-800',
    source: { kind: 'place', vibe: 'chill' },
  },
  {
    key: 'active',
    icon: 'zap',
    title: 'Năng động',
    link: '/spots',
    query: { kieu: 'active' },
    tone: 'from-amber-600 to-orange-700',
    source: { kind: 'spot', vibe: 'active' },
  },
  {
    key: 'romantic',
    icon: 'heart',
    title: 'Lãng mạn',
    link: '/explore',
    query: { kieu: 'romantic' },
    tone: 'from-rose-600 to-pink-800',
    source: { kind: 'place', vibe: 'romantic' },
  },
  {
    key: 'cafe',
    icon: 'cup',
    title: 'Quán cafe',
    link: '/explore',
    query: { loai: 'cafe' },
    tone: 'from-brand-600 to-brand-900',
    source: { kind: 'place', type: 'cafe' },
  },
  {
    key: 'restaurant',
    icon: 'utensils',
    title: 'Quán ăn',
    link: '/explore',
    query: { loai: 'restaurant' },
    tone: 'from-brand-600 to-brand-900',
    source: { kind: 'place', type: 'restaurant' },
  },
  {
    key: 'bar',
    icon: 'cocktail',
    title: 'Quán bar',
    link: '/explore',
    query: { loai: 'bar' },
    tone: 'from-brand-600 to-brand-900',
    source: { kind: 'place', type: 'bar' },
  },
  {
    key: 'spot',
    icon: 'gate',
    title: 'Chỗ chơi',
    link: '/spots',
    query: {},
    tone: 'from-brand-600 to-brand-900',
    source: { kind: 'spot' },
  },
];

/** Số thẻ tối đa trong lưới nổi bật (4 cột × 2 hàng) */
const GRID_SIZE = 8;

/**
 * Trang chủ (/): nơi hạ cánh cho mọi người, khách lẫn người đã đăng nhập. Chỉ để duyệt và dẫn đi; danh sách
 * và bộ lọc nằm ở Khám phá quán / Tìm chỗ chơi, mọi ô ở đây dẫn sang đó với bộ lọc đã chọn sẵn trên đường dẫn.
 * Thứ tự: hero căn giữa với ô tìm; "Hẹn kiểu gì?" (ô ảnh trượt ngang); "Hẹn ở khu nào?" (ô ảnh trượt ngang,
 * số quán); "Điểm hẹn nổi bật" (lưới 4×2, admin chọn); Tìm đối tượng + Autoplan + quiz; chân trang.
 */
@Component({
  selector: 'app-home-page',
  imports: [
    RouterLink,
    PageBannerComponent,
    FeaturedEditorComponent,
    IconComponent,
    AutoplanDialogComponent,
    ScrollRowComponent,
    SiteFooterComponent,
  ],
  template: `
    <div class="flex flex-col gap-10 px-4 pb-8 pt-4 sm:px-6 lg:px-8 lg:pt-5">
      <!-- Hero căn giữa: dùng chung ảnh nền với Khám phá quán (admin đổi ở đâu cũng được) -->
      <app-page-banner
        kicker="Hà Nội, hẹn hò"
        heading="Hẹn ở đâu cũng đẹp."
        tagline="Gợi ý quán cafe, quán ăn, bar và chỗ chơi cho buổi hẹn ở Hà Nội."
        [centered]="true"
        [typing]="true"
        [image]="banner.ready() ? (banner.custom() ?? defaultBanner) : null"
        [imageSrcset]="banner.custom() ? null : defaultSrcset"
        [imagePosition]="banner.custom() ? 'center' : '70% 40%'"
        [credit]="banner.custom() ? null : defaultCredit"
        [editable]="canEdit()"
        [custom]="!!banner.custom()"
        [busy]="banner.busy()"
        (upload)="banner.upload($event)"
        (reset)="banner.reset()"
      >
        <!-- Tìm: Enter hoặc bấm nút thì sang Khám phá quán với từ khoá -->
        <form
          class="mx-auto flex w-full max-w-2xl items-center gap-2"
          role="search"
          (submit)="search($event)"
        >
          <label
            class="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-xl bg-white px-4 text-slate-500 shadow-lg shadow-brand-900/30 sm:h-14"
          >
            <app-icon name="search" [size]="18" />
            <span class="sr-only">Tìm quán</span>
            <input
              type="search"
              name="q"
              [value]="q()"
              (input)="q.set($any($event.target).value)"
              class="min-w-0 flex-1 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
              placeholder="Tên quán, khu vực, kiểu quán…"
            />
          </label>
          <button
            type="submit"
            class="flex h-12 shrink-0 items-center gap-2 rounded-xl bg-brand-600 px-4 text-[15px] font-semibold text-white shadow-lg shadow-brand-900/30 transition hover:bg-brand-700 sm:h-14 sm:px-6"
          >
            <app-icon name="search" [size]="18" [stroke]="2.4" /><span class="max-sm:hidden"
              >Tìm quán</span
            >
          </button>
        </form>
      </app-page-banner>

      <!-- Hẹn kiểu gì: ô ảnh lớn, chữ căn giữa trên ảnh, trượt ngang -->
      <section class="flex flex-col gap-5">
        <h2
          class="flex flex-col items-center gap-2 text-center text-2xl font-extrabold tracking-tight text-slate-900 sm:text-[28px]"
        >
          Hẹn kiểu gì?<span class="h-1 w-12 rounded-full bg-brand-600" aria-hidden="true"></span>
        </h2>
        <app-scroll-row>
          @for (t of purposes; track t.key) {
            <a
              [routerLink]="t.link"
              [queryParams]="t.query"
              class="group relative flex h-[150px] w-[72%] shrink-0 snap-start items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br text-white shadow-sm transition hover:shadow-md sm:h-[190px] sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)]"
              [class]="t.tone"
            >
              @if (tileImage(t.key); as src) {
                <img
                  [src]="src"
                  alt=""
                  loading="lazy"
                  decoding="async"
                  (error)="imageFailed(tileUrl(t.key))"
                  class="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
                <span
                  class="absolute inset-0 bg-black/45 transition group-hover:bg-black/35"
                ></span>
              }
              <span
                class="relative flex items-center gap-2.5 text-2xl font-extrabold tracking-tight [text-shadow:0_2px_12px_rgb(0_0_0/0.5)] sm:text-[28px]"
              >
                <app-icon [name]="t.icon" [size]="24" />{{ t.title }}
              </span>
            </a>
          }
        </app-scroll-row>
      </section>

      <!-- Khu vực: ô ảnh, tên quận và số quán ở góc dưới; chỉ khu vực đang có quán, nhiều quán trước -->
      @if (districtTiles().length) {
        <section class="flex flex-col gap-5">
          <h2
            class="flex flex-col items-center gap-2 text-center text-2xl font-extrabold tracking-tight text-slate-900 sm:text-[28px]"
          >
            Hẹn ở khu nào?<span
              class="h-1 w-12 rounded-full bg-brand-600"
              aria-hidden="true"
            ></span>
          </h2>
          <app-scroll-row>
            @for (d of districtTiles(); track d.code) {
              <a
                routerLink="/explore"
                [queryParams]="{ khuvuc: d.code }"
                class="group relative flex h-[220px] w-[60%] shrink-0 snap-start flex-col justify-end overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-900 p-4 text-white shadow-sm transition hover:shadow-md sm:h-[260px] sm:w-[calc((100%-1rem)/2)] md:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-3rem)/4)]"
              >
                @if (thumb(d.imageUrl); as src) {
                  <img
                    [src]="src"
                    alt=""
                    loading="lazy"
                    decoding="async"
                    (error)="imageFailed(d.imageUrl)"
                    class="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                }
                <span
                  class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent"
                ></span>
                <span class="relative">
                  <span class="block text-xl font-extrabold leading-tight">{{ d.label }}</span>
                  <span class="mt-0.5 block text-[13px] text-white/85">{{ d.count }} quán</span>
                </span>
              </a>
            }
          </app-scroll-row>
        </section>
      }

      <!-- Điểm hẹn nổi bật (admin chọn quán và chỗ chơi): lưới 4 cột, thẻ gọn -->
      @if (cards().length || canEdit()) {
        <section class="flex flex-col gap-5">
          <div class="relative flex justify-center">
            <h2
              class="flex flex-col items-center gap-2 text-center text-2xl font-extrabold tracking-tight text-slate-900 sm:text-[28px]"
            >
              Điểm hẹn nổi bật<span
                class="h-1 w-12 rounded-full bg-brand-600"
                aria-hidden="true"
              ></span>
            </h2>
            @if (canEdit()) {
              <div
                class="flex gap-2 max-sm:mt-3 max-sm:w-full max-sm:justify-center sm:absolute sm:right-0 sm:top-0"
              >
                <button
                  type="button"
                  class="flex min-h-9 items-center gap-1.5 rounded-full border border-brand-200 bg-white px-3 text-[13px] font-medium text-brand-700 transition hover:bg-brand-50"
                  (click)="placeEditorOpen.set(true)"
                >
                  <app-icon name="edit" [size]="14" />Chọn quán
                </button>
                <button
                  type="button"
                  class="flex min-h-9 items-center gap-1.5 rounded-full border border-brand-200 bg-white px-3 text-[13px] font-medium text-brand-700 transition hover:bg-brand-50"
                  (click)="spotEditorOpen.set(true)"
                >
                  <app-icon name="edit" [size]="14" />Chọn chỗ chơi
                </button>
              </div>
            }
          </div>
          @if (cards().length) {
            <div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              @for (c of cards(); track c.key) {
                <a
                  [routerLink]="c.link"
                  class="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
                >
                  <span class="relative block aspect-square overflow-hidden bg-[#EFEAFC]">
                    @if (thumb(c.imageUrl); as src) {
                      <img
                        [src]="src"
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
                      class="absolute left-2.5 top-2.5 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-brand-800"
                      >{{ c.badge }}</span
                    >
                  </span>
                  <span class="flex flex-col gap-0.5 px-3 pb-3 pt-2.5">
                    <span
                      class="truncate text-[15px] font-bold tracking-tight text-slate-900 group-hover:text-brand-700"
                      [title]="c.name"
                      >{{ c.name }}</span
                    >
                    <span class="truncate text-[13px] text-slate-500">{{
                      c.address || 'Chưa có địa chỉ'
                    }}</span>
                  </span>
                </a>
              }
            </div>
          } @else {
            <p
              class="rounded-2xl border border-dashed border-brand-200 bg-white px-6 py-10 text-center text-sm text-slate-500"
            >
              Admin chưa chọn điểm hẹn nổi bật.
            </p>
          }
          <div
            class="flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm font-semibold text-brand-700"
          >
            <a routerLink="/explore" class="hover:underline">Xem tất cả quán →</a>
            <a routerLink="/spots" class="hover:underline">Xem tất cả chỗ chơi →</a>
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
  private readonly seo = inject(SeoService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly canEdit = inject(AuthService).canEdit;

  protected readonly purposes = PURPOSE_TILES;
  protected readonly q = signal('');
  protected readonly autoplanOpen = signal(false);

  /** Ảnh nền: cùng ảnh với Khám phá quán */
  protected readonly banner = editableBanner('explore');
  protected readonly defaultBanner = DEFAULT_BANNER;
  protected readonly defaultSrcset = DEFAULT_BANNER_SRCSET;
  protected readonly defaultCredit = DEFAULT_BANNER_CREDIT;

  /** Ảnh quán tiêu biểu cho từng ô "Hẹn kiểu gì?" (theo key); thiếu = nền gradient */
  private readonly tileImages = signal<Record<string, string>>({});
  /**
   * Ảnh lỗi theo URL gốc: 1 = bản thu nhỏ 800px không có (ảnh cũ chưa sinh bản này) nên dùng ảnh gốc;
   * 2 = ảnh gốc cũng lỗi nên ẩn ảnh, hiện nền màu.
   */
  private readonly failedImages = signal<Map<string, 1 | 2>>(new Map());

  private readonly districts = signal<DistrictOption[]>([]);
  protected readonly districtTiles = computed(() =>
    this.districts()
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count),
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

  /** Quán và chỗ chơi nổi bật xen kẽ theo vị trí admin xếp, tối đa 8 */
  protected readonly cards = computed<VenueCard[]>(() => {
    const places = this.featuredPlaces().map<VenueCard>((f) => ({
      key: 'place:' + f.place.id,
      link: ['/quan', f.place.slug],
      imageUrl: f.place.imageUrl || null,
      badge: PLACE_LABELS[f.place.type].replace(/^quán /, 'Quán '),
      name: f.place.name,
      address: f.place.address,
    }));
    const spots = this.featuredSpots().map<VenueCard>((f) => ({
      key: 'spot:' + f.spot.id,
      link: ['/cho-choi', f.spot.slug],
      imageUrl: f.spot.imageUrl || null,
      badge: SPOT_CATEGORIES.find((c) => c.value === f.spot.category)?.short ?? f.spot.category,
      name: f.spot.name,
      address: f.spot.address,
    }));
    const out: VenueCard[] = [];
    for (let i = 0; i < Math.max(places.length, spots.length); i++) {
      if (places[i]) out.push(places[i]);
      if (spots[i]) out.push(spots[i]);
    }
    return out.slice(0, GRID_SIZE);
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
    this.loadTileImages();
    void this.catalog
      .districts()
      .then((d) => this.districts.set(d))
      .catch(() => undefined);
  }

  ngOnDestroy(): void {
    this.seo.clear();
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

  /** Mỗi ô lấy ảnh của một quán / chỗ chơi tiêu biểu trong nhóm (quán: điểm cao nhất) */
  private loadTileImages(): void {
    for (const t of this.purposes) {
      const src = t.source;
      const req =
        src.kind === 'place'
          ? this.catalog
              .search({
                vibe: src.vibe ? [src.vibe] : [],
                type: src.type ?? '',
                sort: 'rating',
                size: 1,
              })
              .then((r) => r.items[0]?.imageUrl)
          : this.spots
              .search({ vibe: src.vibe ? [src.vibe] : [], size: 1 })
              .then((r) => r.items[0]?.imageUrl);
      void req
        .then((url) => url && this.tileImages.update((m) => ({ ...m, [t.key]: url })))
        .catch(() => undefined);
    }
  }

  protected tileUrl(key: string): string | null {
    return this.tileImages()[key] ?? null;
  }

  protected tileImage(key: string): string | null {
    return this.thumb(this.tileUrl(key));
  }

  /**
   * Ảnh để hiện: bản 800px nếu là ảnh app tải lên và chưa lỗi, không thì ảnh gốc; null = không có ảnh hoặc ảnh
   * gốc cũng lỗi (ô hiện nền màu thay vì icon ảnh vỡ).
   */
  protected thumb(url: string | null | undefined): string | null {
    if (!url) return null;
    const stage = this.failedImages().get(url);
    if (stage === 2) return null;
    const variant = imageVariant(url, 800);
    return stage === 1 || !variant ? url : variant;
  }

  /** Ảnh không tải được: lùi từ bản thu nhỏ về ảnh gốc, rồi từ ảnh gốc về không ảnh */
  protected imageFailed(url: string | null | undefined): void {
    if (!url) return;
    this.failedImages.update((m) => {
      const next = new Map(m);
      const usedVariant = !m.has(url) && imageVariant(url, 800) !== null;
      next.set(url, usedVariant ? 1 : 2);
      return next;
    });
  }

  protected search(event: Event): void {
    event.preventDefault();
    const q = this.q().trim();
    void this.router.navigate(['/explore'], { queryParams: q ? { q } : {} });
  }

  protected cityHint(): void {
    this.toast.show('Sắp có thêm thành phố khác. Hiện HANOIVIBE dành cho Hà Nội.', 'info');
  }
}
