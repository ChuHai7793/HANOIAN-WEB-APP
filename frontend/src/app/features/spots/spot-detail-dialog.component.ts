import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { photosOf } from '../../core/models/place.model';
import { durationText, spotCategory, SpotItem, spotPriceText } from '../../core/models/spot.model';
import { directionsUrl, viewOnMapUrl } from '../../core/utils/gmap-url';
import { IconComponent } from '../../shared/ui/icon.component';
import { DetailModalComponent } from '../../shared/ui/detail-modal.component';
import { VibeTagsComponent } from '../../shared/ui/vibe-tags.component';
import { ReviewsComponent } from '../../shared/ui/reviews.component';

/** Popup chi tiết một chỗ chơi (Tìm chỗ chơi, My place): ảnh, giá, giờ, thời lượng, mô tả, các nút. */
@Component({
  selector: 'app-spot-detail-dialog',
  imports: [RouterLink, ReviewsComponent, DetailModalComponent, IconComponent, VibeTagsComponent],
  template: `
    @if (spot(); as d) {
      <app-detail-modal [title]="d.name" [subtitle]="categoriesText(d) + ' · ' + d.districtLabel" [photos]="photosOf(d)" (dismiss)="closed.emit()">
        <a modalHeaderLink [routerLink]="['/cho-choi', d.slug]" class="flex items-center gap-1 text-[13px] font-semibold text-brand-700 hover:underline">Xem trang<app-icon name="arrowRight" [size]="14" [stroke]="2.4" /></a>
        <div class="flex flex-col gap-4">
          <p class="flex items-start gap-1.5 text-sm text-slate-600">
            <span class="mt-0.5 text-slate-400"><app-icon name="pin" [size]="15" /></span>{{ d.address || 'Chưa có địa chỉ' }}
          </p>
          <app-vibe-tags [vibes]="d.vibes" />
          <dl class="grid grid-cols-2 gap-3 rounded-xl bg-brand-50/60 p-3 text-sm">
            <div>
              <dt class="text-xs text-slate-500">Giá</dt>
              <dd class="font-semibold" [class]="d.priceFrom === 0 && !d.priceTo ? 'text-emerald-600' : 'text-slate-900'">{{ price(d) }}</dd>
            </div>
            <div>
              <dt class="text-xs text-slate-500">Giờ mở cửa</dt>
              <dd class="font-semibold text-slate-900">{{ d.openTime ? d.openTime + '–' + d.closeTime : 'Không giờ cố định' }}</dd>
            </div>
            <div>
              <dt class="text-xs text-slate-500">Thời lượng gợi ý</dt>
              <dd class="font-semibold text-slate-900">{{ d.durationMin ? 'Khoảng ' + duration(d.durationMin) : 'Tuỳ bạn' }}</dd>
            </div>
            <div>
              <dt class="text-xs text-slate-500">Không gian</dt>
              <dd class="font-semibold text-slate-900">{{ d.indoor ? 'Trong nhà' : 'Ngoài trời' }}{{ d.needsBooking ? ' · Cần đặt trước' : '' }}</dd>
            </div>
          </dl>
          @if (d.description) {
            <p class="whitespace-pre-line text-sm leading-relaxed text-slate-700">{{ d.description }}</p>
          }
          @if (d.hoursNote) {
            <p class="flex items-start gap-1.5 text-[13px] italic text-slate-500">
              <span class="mt-0.5 not-italic"><app-icon name="info" [size]="14" /></span>{{ d.hoursNote }}
            </p>
          }
          <app-reviews target="spot" [targetId]="d.id" (summaryChange)="ratingChange.emit($event)" />
        </div>
        <!-- Một hàng: các nút phụ bên trái, Lưu (nút chính) dồn sang phải; màn hẹp mới xuống dòng -->
        <div modalFooter class="flex flex-wrap items-center gap-2">
          <a [href]="mapUrl(d)" target="_blank" rel="noopener" class="flex min-h-10 items-center gap-1.5 rounded-[10px] border border-brand-200 px-3 text-[13px] font-medium text-slate-700 hover:bg-brand-50">
            <app-icon name="pin" [size]="15" />Maps
          </a>
          <a [href]="directions(d)" target="_blank" rel="noopener" class="flex min-h-10 items-center gap-1.5 rounded-[10px] border border-brand-200 px-3 text-[13px] font-medium text-slate-700 hover:bg-brand-50">
            <app-icon name="navigate" [size]="15" />Chỉ đường
          </a>
          <button type="button" class="flex min-h-10 items-center gap-1.5 rounded-[10px] border border-brand-200 px-3 text-[13px] font-medium text-slate-700 hover:bg-brand-50" (click)="plan.emit(d)">
            <app-icon name="route" [size]="15" />Vào plan
          </button>
          @if (d.bookingUrl) {
            <a [href]="d.bookingUrl" target="_blank" rel="noopener" class="flex min-h-10 items-center gap-1.5 rounded-[10px] border border-brand-200 px-3 text-[13px] font-medium text-slate-700 hover:bg-brand-50">
              <app-icon name="calendar" [size]="15" />Đặt chỗ
            </a>
          }
          @if (saved()) {
            <span class="ml-auto flex min-h-10 items-center justify-center gap-1.5 rounded-[10px] bg-brand-100 max-sm:w-full px-3.5 text-[13px] font-semibold text-brand-800">
              <app-icon name="heart" [size]="15" [filled]="true" />Đã lưu
            </span>
          } @else {
            <button type="button" class="ml-auto flex min-h-10 items-center justify-center gap-1.5 rounded-[10px] bg-brand-600 px-4 max-sm:w-full text-[13px] font-semibold text-white hover:bg-brand-700" title="Lưu vào My place" (click)="save.emit(d)">
              <app-icon name="plus" [size]="15" [stroke]="2.4" />Lưu
            </button>
          }
        </div>
      </app-detail-modal>
    }
  `,
})
export class SpotDetailDialogComponent {
  readonly spot = input<SpotItem | null>(null);
  /** Đã có trong My place: ẩn nút Lưu */
  readonly saved = input(false);
  readonly closed = output<void>();
  readonly plan = output<SpotItem>();
  readonly save = output<SpotItem>();
  /** Điểm đánh giá đổi (mình vừa viết / sửa / xoá) */
  readonly ratingChange = output<{ ratingAvg: number | null; ratingCount: number }>();

  protected readonly photosOf = photosOf;
  protected readonly price = spotPriceText;
  protected readonly duration = durationText;
  protected readonly cat = (item: SpotItem) => spotCategory(item.category);
  /** "Vận động · Giải trí": nhóm chính trước, rồi các nhóm khác */
  protected categoriesText(item: SpotItem): string {
    return [item.category, ...(item.extraCategories ?? [])].map((c) => spotCategory(c).label).join(' · ');
  }

  protected mapUrl(item: SpotItem): string {
    return item.googleMapsUrl || viewOnMapUrl(item.lat, item.lng, `${item.name} ${item.address}`);
  }

  protected directions(item: SpotItem): string {
    return directionsUrl(item.lat, item.lng, `${item.name} ${item.address}`);
  }
}
