import { isPlatformBrowser } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, PLATFORM_ID, signal } from '@angular/core';
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
    link: '/quan-cafe',
    query: {},
    tone: 'from-brand-600 to-brand-900',
    source: { kind: 'place', type: 'cafe' },
  },
  {
    key: 'restaurant',
    icon: 'utensils',
    title: 'Quán ăn',
    link: '/quan-an',
    query: {},
    tone: 'from-brand-600 to-brand-900',
    source: { kind: 'place', type: 'restaurant' },
  },
  {
    key: 'bar',
    icon: 'cocktail',
    title: 'Quán bar',
    link: '/quan-bar',
    query: {},
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
  templateUrl: './home.page.html',
})
export class HomePage implements OnInit, OnDestroy {
  private readonly catalog = inject(CatalogService);
  private readonly spots = inject(SpotService);
  private readonly seo = inject(SeoService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly canEdit = inject(AuthService).canEdit;
  private readonly platformId = inject(PLATFORM_ID);

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

  /**
   * Mỗi ô lấy ảnh của một quán / chỗ chơi tiêu biểu trong nhóm (quán: điểm cao nhất). Chỉ chạy trên trình duyệt:
   * ảnh chỉ để trang trí, render trên server mà gọi thêm 7 API thì HTML trả về chậm hẳn.
   */
  private loadTileImages(): void {
    if (!isPlatformBrowser(this.platformId)) return;
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
