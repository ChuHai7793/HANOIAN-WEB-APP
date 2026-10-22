import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ArticleSummary, dateText } from '../../core/models/article.model';
import { DistrictOption, FeaturedItem } from '../../core/models/catalog.model';
import { PLACE_LABELS } from '../../core/models/place.model';
import { ratingText } from '../../core/models/review.model';
import { FeaturedSpot, SPOT_CATEGORIES, spotPriceText } from '../../core/models/spot.model';
import { Vibe } from '../../core/models/vibe.model';
import { SeoService } from '../../core/seo/seo.service';
import { ArticleService } from '../../core/services/article.service';
import { CatalogService } from '../../core/services/catalog.service';
import { SpotService } from '../../core/services/spot.service';
import { ToastService } from '../../core/services/toast.service';
import { FeaturedCard, FeaturedSectionComponent } from '../../shared/ui/featured-section.component';
import { FeaturedEditorComponent } from '../../shared/ui/featured-editor.component';
import { IconComponent, IconName } from '../../shared/ui/icon.component';
import {
  DEFAULT_BANNER,
  DEFAULT_BANNER_CREDIT,
  DEFAULT_BANNER_SRCSET,
  editableBanner,
  PageBannerComponent,
} from '../../shared/ui/page-banner.component';
import { AutoplanDialogComponent } from '../plans/autoplan-dialog.component';

/** Ô "Hẹn kiểu gì?": một kiểu hẹn dẫn tới danh sách đã lọc sẵn */
interface VibeTile {
  vibe: Vibe;
  icon: IconName;
  title: string;
  text: string;
  /** Quán (Khám phá quán) hay chỗ chơi (Tìm chỗ chơi) */
  link: string;
  linkLabel: string;
  /** Lớp nền tím / xanh / hồng của ô */
  tone: string;
}

/** Ô "Đi đâu?": loại quán hoặc chỗ chơi */
interface KindTile {
  icon: IconName;
  label: string;
  link: string;
  query: Record<string, string>;
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

const KIND_TILES: KindTile[] = [
  { icon: 'cup', label: 'Quán cafe', link: '/explore', query: { loai: 'cafe' } },
  { icon: 'utensils', label: 'Quán ăn', link: '/explore', query: { loai: 'restaurant' } },
  { icon: 'cocktail', label: 'Quán bar', link: '/explore', query: { loai: 'bar' } },
  { icon: 'gate', label: 'Chỗ chơi', link: '/spots', query: {} },
];

/**
 * Trang chủ (/): nơi hạ cánh cho mọi người, khách lẫn người đã đăng nhập. Chỉ để duyệt và dẫn đi: ô tìm
 * kiếm, kiểu hẹn, loại quán, điểm hẹn / chỗ chơi nổi bật (admin chọn ở đây), khu vực kèm số quán, Autoplan,
 * Tìm đối tượng, quiz và bài Cẩm nang mới. Danh sách và bộ lọc nằm ở Khám phá quán / Tìm chỗ chơi; mọi ô
 * ở đây dẫn sang đó với bộ lọc đã chọn sẵn trên đường dẫn.
 */
@Component({
  selector: 'app-home-page',
  imports: [
    RouterLink,
    PageBannerComponent,
    FeaturedSectionComponent,
    FeaturedEditorComponent,
    IconComponent,
    AutoplanDialogComponent,
  ],
  template: `
    <div class="flex flex-col gap-8 px-4 pb-12 pt-4 sm:px-6 lg:px-8 lg:pt-5">
      <!-- Banner: dùng chung ảnh nền với Khám phá quán (admin đổi ở đâu cũng được) -->
      <app-page-banner
        kicker="Hà Nội, hẹn hò"
        heading="Hẹn ở đâu cũng đẹp."
        tagline="Quán cafe, quán ăn, bar và chỗ chơi cho buổi hẹn của bạn. Chọn kiểu hẹn, chọn khu vực, hoặc để Autoplan lo."
        [image]="banner.custom() ?? defaultBanner"
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

        <!-- Tìm: Enter hoặc bấm nút thì sang Khám phá quán với từ khoá -->
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
          <!-- Lối tắt theo loại: một hàng vuốt ngang trên điện thoại -->
          <div
            role="group"
            aria-label="Đi đâu"
            class="flex gap-2 max-sm:-mx-4 max-sm:w-[calc(100%+2rem)] max-sm:overflow-x-auto max-sm:px-4 max-sm:[scrollbar-width:none] *:shrink-0 *:whitespace-nowrap sm:contents"
          >
            @for (k of kinds; track k.label) {
              <a
                [routerLink]="k.link"
                [queryParams]="k.query"
                class="flex h-11 items-center gap-2 rounded-full bg-white/15 px-4 text-sm font-medium text-white backdrop-blur transition hover:bg-white/25 sm:bg-white sm:text-slate-700 sm:shadow-lg sm:shadow-brand-900/20 sm:hover:bg-brand-50"
              >
                <span class="text-brand-200 sm:text-brand-600"
                  ><app-icon [name]="k.icon" [size]="17" /></span
                >{{ k.label }}
              </a>
            }
          </div>
        </form>
      </app-page-banner>

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

      <!-- Điểm hẹn nổi bật (admin chọn): bấm thẻ mở trang riêng của quán -->
      <section class="flex flex-col gap-3">
        <app-featured-section
          heading="Điểm hẹn nổi bật"
          storageKey="gfm.featuredHidden"
          [cards]="featuredPlaceCards()"
          [canEdit]="canEdit()"
          (open)="openPlace($event)"
          (edit)="placeEditorOpen.set(true)"
        />
      </section>

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

      <!-- Chỗ chơi nổi bật (admin chọn) -->
      <section class="flex flex-col gap-3">
        <app-featured-section
          heading="Chỗ chơi nổi bật"
          storageKey="gfm.featuredSpotsHidden"
          [cards]="featuredSpotCards()"
          [canEdit]="canEdit()"
          (open)="openSpot($event)"
          (edit)="spotEditorOpen.set(true)"
        />
      </section>

      <!-- Ba lối đi của HANOIVIBE: Autoplan, Tìm đối tượng, Gu hẹn hò -->
      <section class="grid gap-3 sm:grid-cols-3">
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
          routerLink="/dating"
          class="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 transition hover:bg-rose-100/70"
        >
          <span
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#C2335F] shadow-sm"
            ><app-icon name="heart" [size]="20"
          /></span>
          <span>
            <span class="block font-bold text-slate-900">Tìm người đi cùng</span>
            <span class="mt-0.5 block text-sm text-slate-600"
              >Quẹt, match rồi hẹn nhau ở quán cả hai cùng thích.</span
            >
          </span>
        </a>
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
      </section>

      <!-- Cẩm nang: 3 bài mới nhất -->
      @if (articles().length) {
        <section class="flex flex-col gap-3">
          <div class="flex items-baseline justify-between gap-3">
            <h2 class="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
              Cẩm nang hẹn hò
            </h2>
            <a routerLink="/cam-nang" class="text-sm font-semibold text-brand-700 hover:underline"
              >Xem tất cả</a
            >
          </div>
          <div class="grid gap-4 sm:grid-cols-3">
            @for (a of articles(); track a.id) {
              <a
                [routerLink]="['/cam-nang', a.slug]"
                class="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div class="aspect-[16/9] overflow-hidden bg-brand-100">
                  @if (a.coverUrl) {
                    <img
                      [src]="a.coverUrl"
                      [alt]="a.title"
                      loading="lazy"
                      class="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                  }
                </div>
                <div class="flex flex-1 flex-col gap-1 p-3.5">
                  <p class="text-xs text-slate-500">{{ date(a.publishedAt) }}</p>
                  <h3 class="font-bold leading-snug text-slate-900 group-hover:text-brand-700">
                    {{ a.title }}
                  </h3>
                  @if (a.excerpt) {
                    <p class="line-clamp-2 text-sm text-slate-600">{{ a.excerpt }}</p>
                  }
                </div>
              </a>
            }
          </div>
        </section>
      }
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
  private readonly seo = inject(SeoService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly canEdit = inject(AuthService).canEdit;

  protected readonly vibes = VIBE_TILES;
  protected readonly kinds = KIND_TILES;
  protected readonly date = dateText;

  protected readonly q = signal('');
  protected readonly autoplanOpen = signal(false);

  /** Ảnh nền: cùng ảnh với Khám phá quán */
  protected readonly banner = editableBanner('explore');
  protected readonly defaultBanner = DEFAULT_BANNER;
  protected readonly defaultSrcset = DEFAULT_BANNER_SRCSET;
  protected readonly defaultCredit = DEFAULT_BANNER_CREDIT;

  private readonly districts = signal<DistrictOption[]>([]);
  /** Khu vực đang có quán, nhiều quán trước; cùng số thì giữ thứ tự gốc */
  protected readonly districtTiles = computed(() =>
    this.districts()
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count),
  );

  protected readonly articles = signal<ArticleSummary[]>([]);

  private readonly featuredPlaces = signal<FeaturedItem[]>([]);
  protected readonly placeEditorOpen = signal(false);
  protected readonly featuredPlaceCards = computed<FeaturedCard[]>(() =>
    this.featuredPlaces().map((f) => ({
      id: f.place.id,
      position: f.position,
      kicker: f.kicker,
      headline: f.headline,
      imageUrl: f.place.imageUrl || null,
      meta: `${PLACE_LABELS[f.place.type]} · ${f.place.districtLabel}`,
      name: f.place.name,
      address: f.place.address,
      rating:
        f.place.ratingCount && f.place.ratingAvg !== null ? ratingText(f.place.ratingAvg) : null,
      note: null,
    })),
  );
  protected readonly placeSlots = computed(() =>
    this.featuredPlaces().map((f) => ({ id: f.place.id, kicker: f.kicker, headline: f.headline })),
  );

  private readonly featuredSpots = signal<FeaturedSpot[]>([]);
  protected readonly spotEditorOpen = signal(false);
  protected readonly featuredSpotCards = computed<FeaturedCard[]>(() =>
    this.featuredSpots().map((f) => ({
      id: f.spot.id,
      position: f.position,
      kicker: f.kicker,
      headline: f.headline,
      imageUrl: f.spot.imageUrl || null,
      meta: `${SPOT_CATEGORIES.find((c) => c.value === f.spot.category)?.short ?? f.spot.category} · ${f.spot.districtLabel}`,
      name: f.spot.name,
      address: f.spot.address,
      rating: f.spot.ratingCount && f.spot.ratingAvg !== null ? ratingText(f.spot.ratingAvg) : null,
      note: spotPriceText(f.spot),
    })),
  );
  protected readonly spotSlots = computed(() =>
    this.featuredSpots().map((f) => ({ id: f.spot.id, kicker: f.kicker, headline: f.headline })),
  );

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
    void this.catalog
      .districts()
      .then((d) => this.districts.set(d))
      .catch(() => undefined);
    void this.articleApi
      .list(0, 3)
      .then((r) => this.articles.set(r.items))
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

  /** Thẻ nổi bật: mở trang riêng /quan/{slug} */
  protected openPlace(id: string): void {
    const f = this.featuredPlaces().find((x) => x.place.id === id);
    if (f) void this.router.navigate(['/quan', f.place.slug]);
  }

  protected openSpot(id: string): void {
    const f = this.featuredSpots().find((x) => x.spot.id === id);
    if (f) void this.router.navigate(['/cho-choi', f.spot.slug]);
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
