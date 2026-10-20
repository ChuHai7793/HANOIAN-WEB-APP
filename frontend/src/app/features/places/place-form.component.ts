import { Component, computed, DestroyRef, inject, input, output, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ModalComponent } from '../../shared/ui/modal.component';
import { DistrictOption } from '../../core/models/catalog.model';
import { RatingStarsComponent } from '../../shared/ui/rating-stars.component';
import { ImagePickerComponent } from '../../shared/ui/image-picker.component';
import { CUISINES, photosOf, Place, placePriceText, PlaceType, PriceRange, priceRangeFor } from '../../core/models/place.model';
import { BAR_CONFIG, CAFE_CONFIG, PlaceTypeConfig, RESTAURANT_CONFIG } from './place.config';
import { embedMapUrl, isShortMapsLink, parseGmapUrl, viewOnMapUrl } from '../../core/utils/gmap-url';
import { nowIso } from '../../core/utils/id';
import { MapsService } from '../../core/services/maps.service';
import { errorMessage } from '../../core/api/api';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { merge } from 'rxjs';
import { defaultPlaceVibes, Vibe, VibeChoice, VibeSource } from '../../core/models/vibe.model';
import { VibePickerComponent } from '../../shared/ui/vibe-picker.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { PhotoListEditorComponent } from '../../shared/ui/photo-list-editor.component';

const CONFIG_BY_TYPE: Record<PlaceType, PlaceTypeConfig> = {
  cafe: CAFE_CONFIG,
  bar: BAR_CONFIG,
  restaurant: RESTAURANT_CONFIG,
};

const TYPE_OPTIONS = [
  { type: 'cafe' as PlaceType, label: 'Cafe', icon: CAFE_CONFIG.icon },
  { type: 'bar' as PlaceType, label: 'Bar', icon: BAR_CONFIG.icon },
  { type: 'restaurant' as PlaceType, label: 'Quán ăn', icon: RESTAURANT_CONFIG.icon },
];

@Component({
  selector: 'app-place-form',
  imports: [PhotoListEditorComponent, VibePickerComponent, ReactiveFormsModule, ModalComponent, RatingStarsComponent, ImagePickerComponent, IconComponent],
  template: `
    <app-modal
      [title]="place() ? 'Sửa ' + cfg().title.toLowerCase() : cfg().addLabel"
      subtitle="Dán link Google Maps để tự lấy toạ độ"
      width="max-w-3xl"
      (dismiss)="cancel.emit()"
    >
      <form [formGroup]="form" class="space-y-5">
        <!-- Thông tin cơ bản -->
        <div class="grid gap-4 sm:grid-cols-2">
          @if (districts(); as list) {
            <!-- Chỉ form Khám phá quán (admin): đổi được loại quán, kể cả khi sửa -->
            <div class="sm:col-span-2">
              <p class="mb-1.5 text-sm font-medium text-slate-700">Loại quán <span class="text-rose-500">*</span></p>
              <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Loại quán">
                @for (t of typeOptions; track t.type) {
                  <button
                    type="button"
                    role="radio"
                    [attr.aria-checked]="type() === t.type"
                    class="flex min-h-10 items-center gap-2 rounded-xl border px-4 text-sm transition"
                    [class]="type() === t.type ? 'border-brand-500 bg-brand-50 font-semibold text-brand-800' : 'border-slate-200 text-slate-600 hover:border-brand-200'"
                    (click)="type.set(t.type)"
                  >
                    <app-icon [name]="t.icon" [size]="16" />{{ t.label }}
                  </button>
                }
              </div>
              @if (typeChangeHint(); as hint) {
                <p class="mt-1.5 flex items-start gap-1.5 text-xs text-amber-700">
                  <span class="mt-px"><app-icon name="info" [size]="13" /></span>{{ hint }}
                </p>
              }
            </div>
            <div class="sm:col-span-2">
              <label class="mb-1.5 block text-sm font-medium text-slate-700">
                Khu vực <span class="text-rose-500">*</span>
              </label>
              <select
                formControlName="district"
                class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
              >
                <option value="">Chọn quận…</option>
                @for (d of list; track d.code) {
                  <option [value]="d.code">{{ d.label }}</option>
                }
              </select>
              @if (invalid('district')) {
                <p class="mt-1 text-xs text-rose-600">Chọn khu vực của quán.</p>
              }
            </div>
            <div class="sm:col-span-2">
              <app-vibe-picker
                [(choice)]="vibeChoice"
                [defaults]="defaultVibes()"
                [source]="vibesSource()"
                [saved]="vibes()"
              />
            </div>
          }

          <div class="sm:col-span-2">
            <label class="mb-1.5 block text-sm font-medium text-slate-700">
              Tên quán <span class="text-rose-500">*</span>
            </label>
            <input
              type="text"
              formControlName="name"
              maxlength="120"
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
              maxlength="255"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              placeholder="Số nhà, tên đường, phường"
            />
            @if (invalid('address')) {
              <p class="mt-1 text-xs text-rose-600">Vui lòng nhập địa chỉ.</p>
            }
          </div>

          <div class="sm:col-span-2">
            <label class="mb-1.5 block text-sm font-medium text-slate-700">
              Giá mỗi người <span class="font-normal text-slate-400">(VNĐ, không bắt buộc)</span>
            </label>
            <div class="flex items-center gap-2">
              <input type="number" min="0" step="1000" formControlName="priceFrom" placeholder="Từ, vd. 80000" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
              <span class="text-slate-400">–</span>
              <input type="number" min="0" step="1000" formControlName="priceTo" placeholder="Đến (nếu có)" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
            </div>
            @if (priceError()) {
              <p class="mt-1 text-xs text-rose-600">{{ priceError() }}</p>
            } @else if (pricePreview()) {
              <p class="mt-1 text-xs text-slate-500">Trên thẻ hiện <b class="text-slate-700">{{ pricePreview() }}</b>.</p>
            } @else {
              <p class="mt-1 text-xs text-slate-500">Chưa nhập thì thẻ không hiện giá và quán không hiện khi người dùng lọc theo tiền.</p>
            }
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
          @if (cfg().showCuisine) {
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

          @if (cfg().showAmenities) {
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
            <span class="text-brand-600"><app-icon name="pin" [size]="20" /></span>
            <h3 class="text-sm font-semibold text-slate-800">Vị trí trên Google Maps</h3>
          </div>

          <label class="mb-1.5 block text-sm font-medium text-slate-700">Link Google Maps</label>
          <input
            type="url"
            formControlName="googleMapsUrl"
            (input)="syncFromLink()"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            placeholder="https://www.google.com/maps/… hoặc https://maps.app.goo.gl/…"
          />
          @if (resolvingLink()) {
            <p class="mt-1 text-xs text-slate-500">⏳ Đang lấy toạ độ từ link rút gọn…</p>
          } @else if (linkMessage(); as msg) {
            <p class="mt-1 text-xs" [class]="msg.ok ? 'text-emerald-600' : 'text-amber-600'">
              {{ msg.text }}
            </p>
          }

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
            <app-icon name="search" [size]="14" class="mr-1.5 align-middle" />Mở Google Maps tìm quán này
          </a>
        </div>

        <!-- Ảnh + ghi chú -->
        @if (districts()) {
          <app-photo-list-editor [(photos)]="photos" [(uploading)]="photosUploading" [maxSize]="1200" purpose="place" [nameHint]="form.controls.name.value" />
        } @else {
          <app-image-picker
            label="Ảnh quán"
            [value]="imageUrl()"
            (valueChange)="imageUrl.set($event)"
            [maxSize]="900"
            purpose="place"
            [nameHint]="form.controls.name.value"
          />
        }

        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700">Ghi chú</label>
          <textarea
            formControlName="note"
            maxlength="2000"
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
          [disabled]="form.invalid || photosUploading()"
          (click)="submit()"
        >
          {{ photosUploading() ? 'Đang tải ảnh…' : place() ? 'Lưu thay đổi' : 'Thêm quán' }}
        </button>
      </div>
    </app-modal>
  `,
})
export class PlaceFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly maps = inject(MapsService);
  private resolveTimer?: ReturnType<typeof setTimeout>;

  /** Loại quán khi mở form (màn đang đứng); form Khám phá quán cho đổi sang loại khác */
  readonly config = input.required<PlaceTypeConfig>();
  /** null = thêm mới */
  readonly place = input<Place | null>(null);
  /** Có danh sách quận (form của "Khám phá quán"): hiện ô Khu vực, bắt buộc chọn. */
  readonly districts = input<DistrictOption[] | null>(null);
  /** Nhãn kiểu hẹn đang lưu của quán (chỉ form Khám phá quán) */
  readonly vibes = input<Vibe[] | null>(null);
  readonly vibesSource = input<VibeSource | null>(null);

  /** Form Khám phá quán gửi kèm nhãn kiểu hẹn */
  readonly save = output<Place & Partial<{ vibes: Vibe[]; vibesAuto: boolean }>>();
  readonly cancel = output<void>();

  protected readonly cuisines = CUISINES;
  protected readonly typeOptions = TYPE_OPTIONS;

  /** Loại đang chọn: quyết định tiêu đề, ô "Loại món" hay "Wifi / chỗ đậu xe", nhãn kiểu hẹn tự gán */
  protected readonly type = signal<PlaceType>('cafe');
  protected readonly cfg = computed(() => CONFIG_BY_TYPE[this.type()]);
  /** Sửa quán và vừa đổi loại: báo phần thông tin sẽ không được lưu */
  protected readonly typeChangeHint = computed(() => {
    const before = this.place()?.type;
    const after = this.type();
    if (!before || before === after) return null;
    const label = CONFIG_BY_TYPE[after].title.toLowerCase();
    const lost = before === 'restaurant' ? '"Loại món"' : after === 'restaurant' ? '"Wifi" và "Chỗ đậu xe"' : null;
    return (
      `Đổi sang ${label}: ` +
      (lost ? `thông tin ${lost} sẽ không được lưu. ` : '') +
      'Quán trong My place của người đã lưu cũng đổi loại theo.'
    );
  });

  protected readonly coords = signal<{ lat: number; lng: number } | null>(null);
  protected readonly coordinateError = signal(false);
  protected readonly resolvingLink = signal(false);
  protected readonly linkMessage = signal<{ ok: boolean; text: string } | null>(null);
  protected readonly ratingValue = signal(4);
  /** Data URL của ảnh vừa upload, hoặc link ảnh ngoài */
  protected readonly imageUrl = signal('');
  /** Form Khám phá quán: nhiều ảnh (tối đa 6), ảnh đầu là ảnh bìa */
  protected readonly photos = signal<string[]>([]);
  /** Còn ảnh đang tải lên: chờ xong mới cho lưu */
  protected readonly photosUploading = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    address: ['', Validators.required],
    priceRange: ['medium'],
    priceFrom: [null as number | null, Validators.min(0)],
    priceTo: [null as number | null, Validators.min(0)],
    openTime: ['08:00'],
    closeTime: ['22:00'],
    note: [''],
    googleMapsUrl: [''],
    coordinates: [''],
    cuisine: [CUISINES[0]],
    hasWifi: [true],
    hasParking: [false],
    district: [''],
  });

  /** Mặc định "tự gán theo loại"; quán đã có nhãn Claude / admin thì giữ nhãn đó (ngOnInit) */
  protected readonly vibeChoice = signal<VibeChoice>({ vibes: [], auto: true });
  private readonly price = toSignal(this.form.controls.priceRange.valueChanges, {
    initialValue: this.form.controls.priceRange.value,
  });
  private readonly priceFromValue = toSignal(this.form.controls.priceFrom.valueChanges, { initialValue: null });
  private readonly priceToValue = toSignal(this.form.controls.priceTo.valueChanges, { initialValue: null });
  /** "80k–150k/người" khi đã nhập giá cụ thể */
  protected readonly pricePreview = computed(() => {
    const from = this.priceFromValue();
    if (from === null || from === undefined) return '';
    return placePriceText({ priceFrom: from, priceTo: this.priceToValue() ?? null });
  });
  protected readonly priceError = computed(() => {
    const from = this.priceFromValue();
    const to = this.priceToValue();
    if (to !== null && to !== undefined && (from === null || from === undefined)) return 'Nhập "Từ" trước, hoặc xoá "Đến".';
    if (from !== null && from !== undefined && to !== null && to !== undefined && to < from) return '"Đến" phải từ "Từ" trở lên.';
    return '';
  });
  /** Đang nạp quán để sửa: chưa tính lại nhóm giá nội bộ */
  private patching = false;
  private readonly destroyRef = inject(DestroyRef);

  protected readonly defaultVibes = computed(() =>
    defaultPlaceVibes(this.type(), this.price() as PriceRange),
  );

  protected readonly mapPreview = computed<SafeResourceUrl>(() => {
    const c = this.coords();
    const url = embedMapUrl(c?.lat ?? null, c?.lng ?? null, this.form.value.address ?? '');
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  // Component được tạo mới mỗi lần mở modal nên nạp một lần ở ngOnInit là đủ.
  ngOnInit(): void {
    this.type.set(this.place()?.type ?? this.config().type);
    if (this.districts()) {
      this.form.controls.district.setValidators(Validators.required);
      this.form.controls.district.updateValueAndValidity();
    }
    const source = this.vibesSource();
    if (source && source !== 'default') this.vibeChoice.set({ vibes: this.vibes() ?? [], auto: false });
    // Nhóm giá nội bộ (backend dùng cho Autoplan, kiểu hẹn mặc định) suy ra từ giá cụ thể; không có giá thì giữ mặc định
    merge(this.form.controls.priceFrom.valueChanges, this.form.controls.priceTo.valueChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const { priceFrom, priceTo } = this.form.getRawValue();
        if (this.patching || priceFrom === null || priceFrom < 0 || (priceTo !== null && priceTo < priceFrom)) return;
        this.form.controls.priceRange.setValue(priceRangeFor(priceFrom, priceTo));
      });
    this.patchFromInput();
  }

  private patchFromInput(): void {
    const existing = this.place();
    if (!existing) return;

    this.patching = true;
    this.form.patchValue({
      name: existing.name,
      address: existing.address,
      priceRange: existing.priceRange,
      priceFrom: existing.priceFrom ?? null,
      priceTo: existing.priceTo ?? null,
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
      district: existing.district ?? '',
    });
    this.patching = false;
    this.ratingValue.set(existing.rating);
    this.imageUrl.set(existing.imageUrl);
    this.photos.set(photosOf(existing));
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

  /**
   * Link đầy đủ thường đã chứa toạ độ — lấy luôn để khỏi bắt người dùng nhập tay. Link rút gọn
   * (maps.app.goo.gl) thì nhờ server đi theo redirect để lấy toạ độ.
   */
  protected syncFromLink(): void {
    clearTimeout(this.resolveTimer);
    this.linkMessage.set(null);
    const url = (this.form.value.googleMapsUrl ?? '').trim();
    const parsed = parseGmapUrl(url);
    if (parsed.lat !== null && parsed.lng !== null) {
      this.applyCoords(parsed.lat, parsed.lng);
      return;
    }
    if (isShortMapsLink(url)) {
      // Chờ người dùng dán/gõ xong rồi mới gọi server
      this.resolveTimer = setTimeout(() => this.resolveShortLink(url), 400);
    }
  }

  private async resolveShortLink(url: string): Promise<void> {
    const stillCurrent = () => (this.form.value.googleMapsUrl ?? '').trim() === url;
    this.resolvingLink.set(true);
    try {
      const result = await this.maps.resolve(url);
      // Người dùng đã sửa link trong lúc chờ: bỏ kết quả cũ
      if (!stillCurrent()) return;
      if (result.lat !== null && result.lng !== null) {
        this.applyCoords(result.lat, result.lng);
        this.linkMessage.set({ ok: true, text: 'Đã lấy toạ độ từ link rút gọn.' });
      } else {
        this.linkMessage.set({
          ok: false,
          text: 'Link này không chứa toạ độ. Mở link, copy toạ độ rồi dán vào ô bên dưới.',
        });
      }
    } catch (err) {
      if (stillCurrent()) this.linkMessage.set({ ok: false, text: errorMessage(err) });
    } finally {
      this.resolvingLink.set(false);
    }
  }

  private applyCoords(lat: number, lng: number): void {
    this.form.patchValue({ coordinates: `${lat}, ${lng}` });
    this.coords.set({ lat, lng });
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
    if (this.form.invalid || this.priceError() || this.photosUploading()) return;

    const v = this.form.getRawValue();
    const cfg = this.cfg();
    const existing = this.place();
    const c = this.coords();

    const result: Place = {
      id: existing?.id ?? '',
      type: this.type(),
      name: v.name.trim(),
      address: v.address.trim(),
      priceRange: v.priceRange as Place['priceRange'],
      priceFrom: v.priceFrom ?? null,
      priceTo: v.priceFrom === null ? null : (v.priceTo ?? null),
      rating: this.ratingValue(),
      openTime: v.openTime,
      closeTime: v.closeTime,
      imageUrl: this.districts() ? (this.photos()[0] ?? '') : this.imageUrl().trim(),
      note: v.note.trim(),
      googleMapsUrl: v.googleMapsUrl.trim(),
      lat: c?.lat ?? null,
      lng: c?.lng ?? null,
      hasWifi: cfg.showAmenities ? v.hasWifi : undefined,
      hasParking: cfg.showAmenities ? v.hasParking : undefined,
      cuisine: cfg.showCuisine ? v.cuisine : undefined,
      version: existing?.version ?? 0,
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
      ...(this.districts() ? { district: v.district } : {}),
    };
    const vibes = this.vibeChoice();
    const tagged = this.districts()
      ? { ...result, photos: this.photos(), vibes: vibes.auto ? this.defaultVibes() : vibes.vibes, vibesAuto: vibes.auto }
      : result;

    this.save.emit(tagged);
  }
}
