import { Component, computed, inject, input, output, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ModalComponent } from '../../shared/ui/modal.component';
import { RatingStarsComponent } from '../../shared/ui/rating-stars.component';
import { ImagePickerComponent } from '../../shared/ui/image-picker.component';
import { CUISINES, Place, PRICE_RANGES } from '../../core/models/place.model';
import { PlaceTypeConfig } from './place.config';
import { embedMapUrl, parseGmapUrl, viewOnMapUrl } from '../../core/utils/gmap-url';
import { nowIso } from '../../core/utils/id';

@Component({
  selector: 'app-place-form',
  imports: [ReactiveFormsModule, ModalComponent, RatingStarsComponent, ImagePickerComponent],
  template: `
    <app-modal
      [title]="place() ? 'Sửa ' + config().title.toLowerCase() : config().addLabel"
      subtitle="Dán link Google Maps để tự lấy toạ độ"
      width="max-w-3xl"
      (dismiss)="cancel.emit()"
    >
      <form [formGroup]="form" class="space-y-5">
        <!-- Thông tin cơ bản -->
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <label class="mb-1.5 block text-sm font-medium text-slate-700">
              Tên quán <span class="text-rose-500">*</span>
            </label>
            <input
              type="text"
              formControlName="name"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              placeholder="VD: The Workshop Coffee"
            />
            @if (invalid('name')) {
              <p class="mt-1 text-xs text-rose-600">Tên quán tối thiểu 2 ký tự.</p>
            }
          </div>

          <div class="sm:col-span-2">
            <label class="mb-1.5 block text-sm font-medium text-slate-700">
              Địa chỉ <span class="text-rose-500">*</span>
            </label>
            <input
              type="text"
              formControlName="address"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              placeholder="Số nhà, tên đường, phường"
            />
            @if (invalid('address')) {
              <p class="mt-1 text-xs text-rose-600">Vui lòng nhập địa chỉ.</p>
            }
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">Khoảng giá</label>
            <select
              formControlName="priceRange"
              class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              @for (p of priceRanges; track p.value) {
                <option [value]="p.value">{{ p.label }} ({{ p.hint }})</option>
              }
            </select>
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">Giờ mở cửa</label>
            <div class="flex items-center gap-2">
              <input
                type="time"
                formControlName="openTime"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
              <span class="text-slate-400">–</span>
              <input
                type="time"
                formControlName="closeTime"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">Đánh giá của bạn</label>
            <div class="pt-1.5">
              <app-rating-stars
                [value]="ratingValue()"
                (valueChange)="setRating($event)"
                [editable]="true"
                [showValue]="true"
                size="md"
              />
            </div>
          </div>

          <!-- Trường riêng theo loại quán -->
          @if (config().showCuisine) {
            <div class="sm:col-span-2">
              <label class="mb-1.5 block text-sm font-medium text-slate-700">Loại món</label>
              <select
                formControlName="cuisine"
                class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              >
                @for (c of cuisines; track c) {
                  <option [value]="c">{{ c }}</option>
                }
              </select>
            </div>
          }

          @if (config().showAmenities) {
            <div class="flex items-center gap-6 sm:col-span-2">
              <label class="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" formControlName="hasWifi" class="h-4 w-4 rounded accent-brand-600" />
                Có wifi mạnh
              </label>
              <label class="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" formControlName="hasParking" class="h-4 w-4 rounded accent-brand-600" />
                Có chỗ đậu xe
              </label>
            </div>
          }
        </div>

        <!-- Google Maps -->
        <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div class="mb-3 flex items-center gap-2">
            <span class="text-lg">📍</span>
            <h3 class="text-sm font-semibold text-slate-800">Vị trí trên Google Maps</h3>
          </div>

          <label class="mb-1.5 block text-sm font-medium text-slate-700">Link Google Maps</label>
          <input
            type="url"
            formControlName="googleMapsUrl"
            (input)="syncFromLink()"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            placeholder="https://www.google.com/maps/…"
          />

          <label class="mb-1.5 mt-4 block text-sm font-medium text-slate-700">
            Toạ độ <span class="font-normal text-slate-400">(không bắt buộc)</span>
          </label>
          <input
            type="text"
            formControlName="coordinates"
            (input)="syncFromCoordinates()"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            placeholder="10.7743, 106.7043"
          />
          @if (coordinateError()) {
            <p class="mt-1 text-xs text-rose-600">
              Sai định dạng. Cần dạng <code>10.7743, 106.7043</code>.
            </p>
          } @else {
            <p class="mt-1 text-xs text-slate-500">
              Tự điền nếu link ở trên có sẵn toạ độ. Có toạ độ thì app mới tính được khoảng
              cách từ vị trí của bạn.
            </p>
          }

          @if (coords()) {
            <div class="mt-3 overflow-hidden rounded-lg border border-slate-200">
              <iframe
                [src]="mapPreview()"
                class="h-52 w-full"
                loading="lazy"
                referrerpolicy="no-referrer-when-downgrade"
                title="Bản đồ xem trước"
              ></iframe>
            </div>
          }

          <a
            [href]="searchOnMapUrl()"
            target="_blank"
            rel="noopener"
            class="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 transition hover:text-brand-800"
          >
            🔎 Mở Google Maps tìm quán này
          </a>
        </div>

        <!-- Ảnh + ghi chú -->
        <app-image-picker
          label="Ảnh quán"
          [value]="imageUrl()"
          (valueChange)="imageUrl.set($event)"
          [maxSize]="900"
        />

        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700">Ghi chú</label>
          <textarea
            formControlName="note"
            rows="3"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            placeholder="Món nên gọi, giờ nên tới, chỗ ngồi đẹp…"
          ></textarea>
        </div>
      </form>

      <div modalFooter class="contents">
        <button
          type="button"
          class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          (click)="cancel.emit()"
        >
          Huỷ
        </button>
        <button
          type="button"
          class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          [disabled]="form.invalid"
          (click)="submit()"
        >
          {{ place() ? 'Lưu thay đổi' : 'Thêm quán' }}
        </button>
      </div>
    </app-modal>
  `,
})
export class PlaceFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly sanitizer = inject(DomSanitizer);

  readonly config = input.required<PlaceTypeConfig>();
  /** null = thêm mới */
  readonly place = input<Place | null>(null);

  readonly save = output<Place>();
  readonly cancel = output<void>();

  protected readonly priceRanges = PRICE_RANGES;
  protected readonly cuisines = CUISINES;

  protected readonly coords = signal<{ lat: number; lng: number } | null>(null);
  protected readonly coordinateError = signal(false);
  protected readonly ratingValue = signal(4);
  /** Data URL của ảnh vừa upload, hoặc link ảnh ngoài */
  protected readonly imageUrl = signal('');

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    address: ['', Validators.required],
    priceRange: ['medium'],
    openTime: ['08:00'],
    closeTime: ['22:00'],
    note: [''],
    googleMapsUrl: [''],
    coordinates: [''],
    cuisine: [CUISINES[0]],
    hasWifi: [true],
    hasParking: [false],
  });

  protected readonly mapPreview = computed<SafeResourceUrl>(() => {
    const c = this.coords();
    const url = embedMapUrl(c?.lat ?? null, c?.lng ?? null, this.form.value.address ?? '');
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  // Component được tạo mới mỗi lần mở modal nên nạp một lần ở ngOnInit là đủ.
  ngOnInit(): void {
    this.patchFromInput();
  }

  private patchFromInput(): void {
    const existing = this.place();
    if (!existing) return;

    this.form.patchValue({
      name: existing.name,
      address: existing.address,
      priceRange: existing.priceRange,
      openTime: existing.openTime,
      closeTime: existing.closeTime,
      note: existing.note,
      googleMapsUrl: existing.googleMapsUrl,
      coordinates:
        existing.lat !== null && existing.lng !== null
          ? `${existing.lat}, ${existing.lng}`
          : '',
      cuisine: existing.cuisine ?? CUISINES[0],
      hasWifi: existing.hasWifi ?? false,
      hasParking: existing.hasParking ?? false,
    });
    this.ratingValue.set(existing.rating);
    this.imageUrl.set(existing.imageUrl);
    if (existing.lat !== null && existing.lng !== null) {
      this.coords.set({ lat: existing.lat, lng: existing.lng });
    }
  }

  protected invalid(control: string): boolean {
    const c = this.form.get(control);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  protected setRating(value: number): void {
    this.ratingValue.set(value);
  }

  /** Mở Google Maps tìm sẵn quán đang nhập, để người dùng copy toạ độ về */
  protected searchOnMapUrl(): string {
    const { name, address } = this.form.value;
    const query = [name, address].filter(Boolean).join(' ').trim();
    return viewOnMapUrl(null, null, query || 'quán cà phê gần đây');
  }

  /** Link đầy đủ thường đã chứa toạ độ — lấy luôn để khỏi bắt người dùng nhập tay */
  protected syncFromLink(): void {
    const parsed = parseGmapUrl(this.form.value.googleMapsUrl ?? '');
    if (parsed.lat === null || parsed.lng === null) return;
    this.form.patchValue({ coordinates: `${parsed.lat}, ${parsed.lng}` });
    this.coords.set({ lat: parsed.lat, lng: parsed.lng });
    this.coordinateError.set(false);
  }

  protected syncFromCoordinates(): void {
    const raw = (this.form.value.coordinates ?? '').trim();
    if (!raw) {
      this.coords.set(null);
      this.coordinateError.set(false);
      return;
    }
    const parsed = parseGmapUrl(raw);
    const ok = parsed.lat !== null && parsed.lng !== null;
    this.coords.set(ok ? { lat: parsed.lat!, lng: parsed.lng! } : null);
    this.coordinateError.set(!ok);
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const v = this.form.getRawValue();
    const cfg = this.config();
    const existing = this.place();
    const c = this.coords();

    const result: Place = {
      id: existing?.id ?? '',
      type: cfg.type,
      name: v.name.trim(),
      address: v.address.trim(),
      priceRange: v.priceRange as Place['priceRange'],
      rating: this.ratingValue(),
      openTime: v.openTime,
      closeTime: v.closeTime,
      imageUrl: this.imageUrl().trim(),
      note: v.note.trim(),
      googleMapsUrl: v.googleMapsUrl.trim(),
      lat: c?.lat ?? null,
      lng: c?.lng ?? null,
      hasWifi: cfg.showAmenities ? v.hasWifi : undefined,
      hasParking: cfg.showAmenities ? v.hasParking : undefined,
      cuisine: cfg.showCuisine ? v.cuisine : undefined,
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };

    this.save.emit(result);
  }
}
