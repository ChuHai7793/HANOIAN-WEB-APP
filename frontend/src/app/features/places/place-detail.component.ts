import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ModalComponent } from '../../shared/ui/modal.component';
import { RatingStarsComponent } from '../../shared/ui/rating-stars.component';
import { Place, PLACE_ICONS, priceLabel } from '../../core/models/place.model';
import { PlaceLinkService } from '../../core/services/place-link.service';
import { GirlfriendService } from '../../core/services/girlfriend.service';
import { Girlfriend } from '../../core/models/girlfriend.model';
import { PlaceLink } from '../../core/models/place-link.model';
import { directionsUrl, embedMapUrl, viewOnMapUrl } from '../../core/utils/gmap-url';
import { formatDistance } from '../../core/utils/geo';

interface Companion {
  girlfriend: Girlfriend;
  link: PlaceLink;
}

@Component({
  selector: 'app-place-detail',
  imports: [RouterLink, ModalComponent, RatingStarsComponent],
  template: `
    <app-modal [title]="place().name" [subtitle]="place().address" width="max-w-3xl" (dismiss)="dismiss.emit()">
      <div class="space-y-5">
        <!-- Ảnh lớn: hiện trọn ảnh, cao tối đa 28rem, không cắt xén -->
        <div class="overflow-hidden rounded-xl bg-slate-100">
          @if (place().imageUrl) {
            <img
              [src]="place().imageUrl"
              [alt]="place().name"
              class="mx-auto max-h-[28rem] w-auto max-w-full object-contain"
            />
          } @else {
            <div class="flex h-64 items-center justify-center text-6xl opacity-30">
              {{ icon() }}
            </div>
          }
        </div>

        <!-- Đánh giá + thẻ thuộc tính -->
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <app-rating-stars [value]="place().rating" [showValue]="true" size="md" />
          <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {{ priceText() }}
          </span>
          @if (distanceKm() !== null) {
            <span class="rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">
              Cách bạn {{ distanceText() }}
            </span>
          }
        </div>

        <!-- Thông tin -->
        <dl class="grid gap-x-6 gap-y-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
          <div class="flex justify-between gap-4 text-sm">
            <dt class="text-slate-500">Giờ mở cửa</dt>
            <dd class="font-medium text-slate-800">
              {{ place().openTime }} – {{ place().closeTime }}
            </dd>
          </div>

          @if (place().cuisine) {
            <div class="flex justify-between gap-4 text-sm">
              <dt class="text-slate-500">Loại món</dt>
              <dd class="font-medium text-slate-800">{{ place().cuisine }}</dd>
            </div>
          }

          @if (place().type !== 'restaurant') {
            <div class="flex justify-between gap-4 text-sm">
              <dt class="text-slate-500">Wifi</dt>
              <dd class="font-medium text-slate-800">{{ place().hasWifi ? 'Có' : 'Không' }}</dd>
            </div>
            <div class="flex justify-between gap-4 text-sm">
              <dt class="text-slate-500">Chỗ đậu xe</dt>
              <dd class="font-medium text-slate-800">{{ place().hasParking ? 'Có' : 'Không' }}</dd>
            </div>
          }

          <div class="flex justify-between gap-4 text-sm sm:col-span-2">
            <dt class="shrink-0 text-slate-500">Địa chỉ</dt>
            <dd class="text-right font-medium text-slate-800">{{ place().address }}</dd>
          </div>

          <div class="flex justify-between gap-4 text-sm sm:col-span-2">
            <dt class="shrink-0 text-slate-500">Toạ độ</dt>
            <dd class="text-right font-medium text-slate-800">
              {{ coordsText() }}
            </dd>
          </div>
        </dl>

        @if (place().note) {
          <div>
            <h3 class="mb-1.5 text-sm font-semibold text-slate-800">Ghi chú</h3>
            <p class="whitespace-pre-line rounded-xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
              {{ place().note }}
            </p>
          </div>
        }

        <!-- Đã đi cùng ai -->
        <div>
          <h3 class="mb-2 text-sm font-semibold text-slate-800">
            Đã đi cùng
            <span class="font-normal text-slate-400">({{ companions().length }})</span>
          </h3>

          @if (companions().length === 0) {
            <p class="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
              Chưa gắn quán này với ai. Vào màn Người yêu → chi tiết → gắn quán.
            </p>
          } @else {
            <div class="space-y-2">
              @for (c of companions(); track c.link.id) {
                <a
                  [routerLink]="['/girlfriends', c.girlfriend.id]"
                  class="flex items-start gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-brand-300 hover:bg-slate-50"
                >
                  @if (c.girlfriend.avatarUrl) {
                    <img
                      [src]="c.girlfriend.avatarUrl"
                      [alt]="c.girlfriend.name"
                      class="h-10 w-10 shrink-0 rounded-full object-cover"
                    />
                  } @else {
                    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50">
                      👤
                    </div>
                  }
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span class="text-sm font-medium text-slate-800">
                        {{ c.girlfriend.nickname || c.girlfriend.name }}
                      </span>
                      <app-rating-stars [value]="c.link.herRating" />
                      <span class="text-xs text-slate-400">
                        {{ formatDate(c.link.lastVisitedAt) }}
                      </span>
                    </div>
                    @if (c.link.memory) {
                      <p class="mt-1 text-sm italic text-slate-500">💭 {{ c.link.memory }}</p>
                    }
                  </div>
                </a>
              }
            </div>
          }
        </div>

        <!-- Bản đồ -->
        <div>
          <h3 class="mb-2 text-sm font-semibold text-slate-800">Vị trí</h3>
          <div class="overflow-hidden rounded-xl border border-slate-200">
            <iframe
              [src]="mapUrl()"
              class="h-64 w-full"
              loading="lazy"
              referrerpolicy="no-referrer-when-downgrade"
              [title]="'Bản đồ ' + place().name"
            ></iframe>
          </div>
          @if (place().lat === null) {
            <p class="mt-2 text-xs text-slate-500">
              Quán chưa có toạ độ nên bản đồ đang tìm theo tên và địa chỉ.
            </p>
          }
        </div>
      </div>

      <div modalFooter class="contents">
        <button
          type="button"
          class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          (click)="edit.emit()"
        >
          ✏️ Sửa quán
        </button>
        <a
          [href]="mapsLink()"
          target="_blank"
          rel="noopener"
          class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          Mở Google Maps
        </a>
        <a
          [href]="directionsLink()"
          target="_blank"
          rel="noopener"
          class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          🧭 Chỉ đường
        </a>
      </div>
    </app-modal>
  `,
})
export class PlaceDetailComponent {
  private readonly linkService = inject(PlaceLinkService);
  private readonly girlfriendService = inject(GirlfriendService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly place = input.required<Place>();
  readonly distanceKm = input<number | null>(null);

  readonly edit = output<void>();
  readonly dismiss = output<void>();

  protected readonly icon = computed(() => PLACE_ICONS[this.place().type]);
  protected readonly priceText = computed(() => priceLabel(this.place().priceRange));
  protected readonly distanceText = computed(() => {
    const km = this.distanceKm();
    return km === null ? '' : formatDistance(km);
  });

  protected readonly coordsText = computed(() => {
    const p = this.place();
    return p.lat !== null && p.lng !== null ? `${p.lat}, ${p.lng}` : 'Chưa có';
  });

  /** Những người yêu đã được gắn với quán này */
  protected readonly companions = computed<Companion[]>(() => {
    const placeId = this.place().id;
    return this.linkService
      .items()
      .filter((link) => link.placeId === placeId)
      .map((link) => ({
        link,
        girlfriend: this.girlfriendService.byId(link.girlfriendId),
      }))
      .filter((row): row is Companion => !!row.girlfriend)
      .sort((a, b) => b.link.herRating - a.link.herRating);
  });

  protected readonly mapUrl = computed<SafeResourceUrl>(() => {
    const p = this.place();
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      embedMapUrl(p.lat, p.lng, `${p.name} ${p.address}`),
    );
  });

  /** Ưu tiên đúng link đã lưu; chỉ khi bỏ trống mới tự dựng link tìm kiếm */
  protected mapsLink(): string {
    const p = this.place();
    return p.googleMapsUrl.trim() || viewOnMapUrl(p.lat, p.lng, `${p.name} ${p.address}`);
  }

  protected directionsLink(): string {
    const p = this.place();
    return directionsUrl(p.lat, p.lng, `${p.name} ${p.address}`);
  }

  protected formatDate(value: string): string {
    if (!value) return '–';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '–' : d.toLocaleDateString('vi-VN');
  }
}
