import { Component, computed, inject, input, OnDestroy, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { errorCode } from '../../core/api/api';
import { LoginGate } from '../../core/auth/login-gate.service';
import { CatalogItem } from '../../core/models/catalog.model';
import { photosOf, PLACE_LABELS, priceLabel } from '../../core/models/place.model';
import { ratingText } from '../../core/models/review.model';
import { durationText, spotCategory, SpotItem, spotPriceText } from '../../core/models/spot.model';
import { SeoService } from '../../core/seo/seo.service';
import { CatalogService } from '../../core/services/catalog.service';
import { SavedSpotService } from '../../core/services/saved-spot.service';
import { SpotService } from '../../core/services/spot.service';
import { ToastService } from '../../core/services/toast.service';
import { directionsUrl, embedMapUrl, viewOnMapUrl } from '../../core/utils/gmap-url';
import { AddToPlanDialogComponent } from '../plans/add-to-plan-dialog.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { PhotoCarouselComponent } from '../../shared/ui/photo-carousel.component';
import { ReviewsComponent } from '../../shared/ui/reviews.component';
import { VibeTagsComponent } from '../../shared/ui/vibe-tags.component';

type Kind = 'place' | 'spot';

interface Fact {
  label: string;
  value: string;
}

/** Thông tin chung của quán / chỗ chơi để hiển thị một kiểu */
interface Venue {
  kind: Kind;
  id: string;
  slug: string;
  name: string;
  typeLabel: string;
  district: string;
  districtLabel: string;
  address: string;
  description: string;
  photos: string[];
  vibes: CatalogItem['vibes'];
  ratingAvg: number | null;
  ratingCount: number;
  lat: number | null;
  lng: number | null;
  googleMapsUrl: string;
  facts: Fact[];
  inMyPlace: boolean;
  bookingUrl: string;
  /** Dữ liệu gốc cho JSON-LD */
  raw: CatalogItem | SpotItem;
}

/**
 * Trang riêng của một quán (/quan/:slug) hoặc chỗ chơi (/cho-choi/:slug): render trên server (bản SSR) để Google,
 * Zalo, Facebook đọc được; có title / description / ảnh chia sẻ, link canonical và JSON-LD (kèm ★ nếu có đánh giá).
 */
@Component({
  selector: 'app-venue-page',
  imports: [RouterLink, IconComponent, PhotoCarouselComponent, ReviewsComponent, VibeTagsComponent, AddToPlanDialogComponent],
  template: `
    <div class="mx-auto flex max-w-6xl flex-col gap-5 px-4 pb-12 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <nav class="text-[13px] text-slate-500" aria-label="Đường dẫn">
        <a [routerLink]="kind() === 'place' ? '/explore' : '/spots'" class="hover:text-brand-700">{{ kind() === 'place' ? 'Khám phá quán' : 'Tìm chỗ chơi' }}</a>
        @if (venue(); as v) {
          <span class="mx-1.5 text-slate-300">/</span><span class="text-slate-800">{{ v.name }}</span>
        }
      </nav>

      @if (notFound()) {
        <div class="rounded-2xl border border-dashed border-brand-200 bg-white px-6 py-14 text-center text-sm text-slate-500">
          Không tìm thấy {{ kind() === 'place' ? 'quán' : 'chỗ chơi' }} này.
          <a [routerLink]="kind() === 'place' ? '/explore' : '/spots'" class="ml-1 font-semibold text-brand-700 hover:underline">Xem danh sách</a>
        </div>
      } @else if (venue(); as v) {
        <article class="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
          <div class="overflow-hidden rounded-2xl bg-slate-900">
            @if (v.photos.length) {
              <app-photo-carousel class="aspect-[4/3] w-full lg:aspect-auto lg:h-full lg:min-h-[460px]" [photos]="v.photos" [alt]="v.name" [lazy]="false" [contain]="true" [backdrop]="true" />
            } @else {
              <div class="flex aspect-[4/3] items-center justify-center text-white/60"><app-icon name="image" [size]="40" /></div>
            }
          </div>

          <div class="flex flex-col gap-4">
            <header>
              <p class="text-[13px] font-semibold uppercase tracking-[0.14em] text-brand-600">{{ v.typeLabel }} · {{ v.districtLabel }}</p>
              <h1 class="mt-1 text-[28px] font-extrabold leading-tight tracking-tight text-slate-900 sm:text-[34px]">{{ v.name }}</h1>
              <p class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
                @if (v.ratingCount && v.ratingAvg !== null) {
                  <span class="font-semibold text-slate-800"><span class="text-[#E29A2D]">★</span> {{ rating(v.ratingAvg) }} <span class="font-normal text-slate-500">({{ v.ratingCount }} đánh giá)</span></span>
                } @else {
                  <span class="text-slate-500">Chưa có đánh giá</span>
                }
                <span class="flex items-start gap-1"><span class="mt-0.5 text-slate-400"><app-icon name="pin" [size]="15" /></span>{{ v.address || 'Chưa có địa chỉ' }}</span>
              </p>
            </header>

            <app-vibe-tags [vibes]="v.vibes" />

            <dl class="grid grid-cols-2 gap-3 rounded-xl bg-brand-50/60 p-4 text-sm">
              @for (f of v.facts; track f.label) {
                <div>
                  <dt class="text-xs text-slate-500">{{ f.label }}</dt>
                  <dd class="font-semibold text-slate-900">{{ f.value }}</dd>
                </div>
              }
            </dl>

            @if (v.description) {
              <p class="whitespace-pre-line text-[15px] leading-relaxed text-slate-700">{{ v.description }}</p>
            }

            <div class="flex flex-wrap gap-2">
              @if (!v.inMyPlace) {
                <button type="button" class="flex min-h-10 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60" [disabled]="busy()" (click)="save(v)">
                  <app-icon name="plus" [size]="16" [stroke]="2.4" />Lưu vào My place
                </button>
              } @else {
                <span class="flex min-h-10 items-center gap-1.5 rounded-xl bg-brand-100 px-4 text-sm font-semibold text-brand-800"><app-icon name="heart" [size]="16" [filled]="true" />Đã lưu</span>
              }
              <button type="button" class="flex min-h-10 items-center gap-1.5 rounded-xl border border-brand-200 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-brand-50" (click)="planOpen.set(true)">
                <app-icon name="route" [size]="16" />Vào plan
              </button>
              <a [href]="directions(v)" target="_blank" rel="noopener" class="flex min-h-10 items-center gap-1.5 rounded-xl border border-brand-200 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-brand-50">
                <app-icon name="navigate" [size]="16" />Chỉ đường
              </a>
              @if (v.bookingUrl) {
                <a [href]="v.bookingUrl" target="_blank" rel="noopener" class="flex min-h-10 items-center gap-1.5 rounded-xl border border-brand-200 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-brand-50">
                  <app-icon name="calendar" [size]="16" />Đặt chỗ
                </a>
              }
            </div>

            @if (mapSrc(); as src) {
              <iframe [src]="src" title="Bản đồ" class="h-56 w-full rounded-xl border border-slate-200" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
              <a [href]="mapUrl(v)" target="_blank" rel="noopener" class="-mt-2 text-[13px] font-medium text-brand-700 hover:underline">Mở trên Google Maps</a>
            }
          </div>
        </article>

        <div class="max-w-3xl">
          <app-reviews [target]="v.kind" [targetId]="v.id" (summaryChange)="onRatingChange($event)" />
        </div>

        <a [routerLink]="kind() === 'place' ? '/explore' : '/spots'" class="w-fit text-sm font-semibold text-brand-700 hover:underline">
          ← Xem thêm {{ kind() === 'place' ? 'quán khác ở Hà Nội' : 'chỗ chơi khác ở Hà Nội' }}
        </a>
      } @else {
        <p class="text-sm text-slate-500">Đang tải…</p>
      }
    </div>

    @if (planOpen() && venue(); as v) {
      <app-add-to-plan-dialog [kind]="v.kind" [refId]="v.id" [name]="v.name" [district]="v.district" (closed)="planOpen.set(false)" />
    }
  `,
})
export class VenuePage implements OnDestroy {
  private readonly catalog = inject(CatalogService);
  private readonly spots = inject(SpotService);
  private readonly savedSpots = inject(SavedSpotService);
  private readonly seo = inject(SeoService);
  private readonly gate = inject(LoginGate);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);

  /** Từ route data: place (/quan/:slug) hoặc spot (/cho-choi/:slug) */
  readonly kind = input<Kind>('place');
  readonly slug = input.required<string>();

  protected readonly venue = signal<Venue | null>(null);
  protected readonly notFound = signal(false);
  protected readonly busy = signal(false);
  protected readonly planOpen = signal(false);
  protected readonly rating = ratingText;
  protected readonly mapSrc = computed<SafeResourceUrl | null>(() => {
    const v = this.venue();
    if (!v || v.lat === null || v.lng === null) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(embedMapUrl(v.lat, v.lng, `${v.name} ${v.address}`));
  });

  async ngOnInit(): Promise<void> {
    try {
      const v = this.kind() === 'place' ? this.fromPlace(await this.catalog.bySlug(this.slug())) : this.fromSpot(await this.spots.bySlug(this.slug()));
      this.venue.set(v);
      this.applySeo(v);
    } catch (err) {
      if (errorCode(err) === 'NOT_FOUND') {
        this.notFound.set(true);
        this.seo.notFound('Không tìm thấy', this.path());
      }
    }
  }

  ngOnDestroy(): void {
    this.seo.clear();
  }

  protected directions(v: Venue): string {
    return directionsUrl(v.lat, v.lng, `${v.name} ${v.address}`);
  }

  protected mapUrl(v: Venue): string {
    return v.googleMapsUrl || viewOnMapUrl(v.lat, v.lng, `${v.name} ${v.address}`);
  }

  protected onRatingChange(r: { ratingAvg: number | null; ratingCount: number }): void {
    this.venue.update((v) => (v ? { ...v, ...r } : v));
  }

  protected async save(v: Venue): Promise<void> {
    if (!this.gate.check(v.kind === 'place' ? 'lưu quán vào My place' : 'lưu chỗ chơi vào My place', () => this.save(v))) return;
    this.busy.set(true);
    try {
      if (v.kind === 'place') await this.catalog.addToMyPlace(v.id);
      else await this.savedSpots.save(v.raw as SpotItem);
      this.venue.update((x) => (x ? { ...x, inMyPlace: true } : x));
      this.toast.success('Đã lưu vào My place.');
    } catch (err) {
      if (errorCode(err) === 'ALREADY_IN_MY_PLACE') this.venue.update((x) => (x ? { ...x, inMyPlace: true } : x));
    } finally {
      this.busy.set(false);
    }
  }

  private path(): string {
    return `/${this.kind() === 'place' ? 'quan' : 'cho-choi'}/${this.slug()}`;
  }

  private fromPlace(p: CatalogItem): Venue {
    const amenities = [p.hasWifi ? 'Wifi' : '', p.hasParking ? 'Đậu xe' : ''].filter(Boolean).join(' · ') || '—';
    return {
      kind: 'place',
      id: p.id,
      slug: p.slug,
      name: p.name,
      typeLabel: PLACE_LABELS[p.type],
      district: p.district,
      districtLabel: p.districtLabel,
      address: p.address,
      description: p.note,
      photos: photosOf(p),
      vibes: p.vibes,
      ratingAvg: p.ratingAvg,
      ratingCount: p.ratingCount,
      lat: p.lat,
      lng: p.lng,
      googleMapsUrl: p.googleMapsUrl,
      facts: [
        { label: 'Mức giá', value: priceLabel(p.priceRange) },
        { label: 'Giờ mở cửa', value: `${p.openTime}–${p.closeTime}` },
        p.type === 'restaurant' ? { label: 'Món', value: p.cuisine || '—' } : { label: 'Tiện ích', value: amenities },
        { label: 'HANOIVIBE chấm', value: `${p.rating}/5` },
      ],
      inMyPlace: p.inMyPlace,
      bookingUrl: '',
      raw: p,
    };
  }

  private fromSpot(s: SpotItem): Venue {
    const cats = [s.category, ...(s.extraCategories ?? [])].map((c) => spotCategory(c).label);
    return {
      kind: 'spot',
      id: s.id,
      slug: s.slug,
      name: s.name,
      typeLabel: cats.join(' · '),
      district: s.district,
      districtLabel: s.districtLabel,
      address: s.address,
      description: [s.description, s.hoursNote].filter(Boolean).join('\n\n'),
      photos: photosOf(s),
      vibes: s.vibes,
      ratingAvg: s.ratingAvg,
      ratingCount: s.ratingCount,
      lat: s.lat,
      lng: s.lng,
      googleMapsUrl: s.googleMapsUrl,
      facts: [
        { label: 'Giá', value: spotPriceText(s) },
        { label: 'Giờ mở cửa', value: s.openTime ? `${s.openTime}–${s.closeTime}` : 'Không giờ cố định' },
        { label: 'Thời lượng gợi ý', value: s.durationMin ? 'Khoảng ' + durationText(s.durationMin) : 'Tuỳ bạn' },
        { label: 'Không gian', value: (s.indoor ? 'Trong nhà' : 'Ngoài trời') + (s.needsBooking ? ' · Cần đặt trước' : '') },
      ],
      inMyPlace: s.inMyPlace,
      bookingUrl: s.bookingUrl,
      raw: s,
    };
  }

  /** Title, mô tả, ảnh chia sẻ, canonical và JSON-LD theo schema.org */
  private applySeo(v: Venue): void {
    const where = `${v.address ? v.address + ', ' : ''}${v.districtLabel}, Hà Nội`;
    const description =
      (v.description ? v.description + ' ' : '') + `${v.typeLabel} ở ${where}. Xem ảnh, giờ mở cửa, giá và đánh giá trên HANOIVIBE.`;
    const raw = v.raw as Partial<CatalogItem & SpotItem>;
    const schemaType =
      v.kind === 'spot' ? 'TouristAttraction' : raw.type === 'cafe' ? 'CafeOrCoffeeShop' : raw.type === 'bar' ? 'BarOrPub' : 'Restaurant';
    const jsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': schemaType,
      name: v.name,
      url: this.seo.absolute(this.path()),
      image: v.photos.map((p) => this.seo.absolute(p)),
      description: v.description || undefined,
      address: {
        '@type': 'PostalAddress',
        streetAddress: v.address || undefined,
        addressLocality: v.districtLabel,
        addressRegion: 'Hà Nội',
        addressCountry: 'VN',
      },
    };
    if (v.lat !== null && v.lng !== null) jsonLd['geo'] = { '@type': 'GeoCoordinates', latitude: v.lat, longitude: v.lng };
    if (raw.openTime && raw.closeTime) {
      jsonLd['openingHoursSpecification'] = {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        opens: raw.openTime,
        closes: raw.closeTime,
      };
    }
    if (v.kind === 'place' && raw.type === 'restaurant' && raw.cuisine) jsonLd['servesCuisine'] = raw.cuisine;
    if (v.ratingCount > 0 && v.ratingAvg !== null) {
      jsonLd['aggregateRating'] = { '@type': 'AggregateRating', ratingValue: v.ratingAvg, reviewCount: v.ratingCount, bestRating: 5, worstRating: 1 };
    }
    this.seo.set({
      title: `${v.name}: ${v.typeLabel.split(' · ')[0]} ${v.districtLabel}`,
      description,
      image: v.photos[0] ?? null,
      path: this.path(),
      jsonLd,
    });
  }
}
