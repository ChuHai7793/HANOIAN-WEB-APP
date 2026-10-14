import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { DistrictOption } from '../../core/models/catalog.model';
import { SPOT_CATEGORIES, SpotCategory, SpotItem } from '../../core/models/spot.model';
import { SpotRequest } from '../../core/services/spot.service';
import { parseGmapUrl } from '../../core/utils/gmap-url';
import { ModalComponent } from '../../shared/ui/modal.component';
import { toSignal } from '@angular/core/rxjs-interop';
import { defaultSpotVibes, VibeChoice } from '../../core/models/vibe.model';
import { VibePickerComponent } from '../../shared/ui/vibe-picker.component';
import { PhotoListEditorComponent } from '../../shared/ui/photo-list-editor.component';

const INPUT =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100';

/** Giờ mở và giờ đóng: cùng trống hoặc cùng có. Giá đến (nếu có) không nhỏ hơn giá từ. */
function spotFormRules(group: AbstractControl): ValidationErrors | null {
  const v = group.value as { openTime: string; closeTime: string; priceFrom: number | null; priceTo: number | null };
  const errors: ValidationErrors = {};
  if (!v.openTime !== !v.closeTime) errors['halfHours'] = true;
  if (v.priceTo !== null && v.priceFrom !== null && v.priceTo < v.priceFrom) errors['priceOrder'] = true;
  return Object.keys(errors).length ? errors : null;
}

/** Admin thêm/sửa chỗ chơi trong "Tìm chỗ chơi". */
@Component({
  selector: 'app-spot-form',
  imports: [PhotoListEditorComponent, ReactiveFormsModule, ModalComponent, VibePickerComponent],
  template: `
    <app-modal
      [title]="spot() ? 'Sửa chỗ chơi' : 'Thêm chỗ chơi'"
      subtitle="Giá theo VNĐ/người, để 0 nếu miễn phí"
      width="max-w-3xl"
      (dismiss)="cancel.emit()"
    >
      <form [formGroup]="form" class="space-y-5">
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">Nhóm <span class="text-rose-500">*</span></label>
            <select formControlName="category" [class]="input + ' bg-white'">
              @for (c of categories; track c.value) {
                <option [value]="c.value">{{ c.label }}</option>
              }
            </select>
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">Khu vực <span class="text-rose-500">*</span></label>
            <select formControlName="district" [class]="input + ' bg-white'">
              <option value="">Chọn quận…</option>
              @for (d of districts(); track d.code) {
                <option [value]="d.code">{{ d.label }}</option>
              }
            </select>
            @if (invalid('district')) {
              <p class="mt-1 text-xs text-rose-600">Chọn khu vực.</p>
            }
          </div>
          <div class="sm:col-span-2">
            <app-vibe-picker
              [(choice)]="vibeChoice"
              [defaults]="defaultVibes()"
              [source]="spot()?.vibesSource ?? null"
              [saved]="spot()?.vibes ?? null"
            />
          </div>

          <div class="sm:col-span-2">
            <label class="mb-1.5 block text-sm font-medium text-slate-700">Tên <span class="text-rose-500">*</span></label>
            <input type="text" formControlName="name" [class]="input" placeholder="VD: Bảo tàng Phụ nữ Việt Nam" />
            @if (invalid('name')) {
              <p class="mt-1 text-xs text-rose-600">Tên tối thiểu 2 ký tự.</p>
            }
          </div>

          <div class="sm:col-span-2">
            <label class="mb-1.5 block text-sm font-medium text-slate-700">Địa chỉ</label>
            <input type="text" formControlName="address" [class]="input" placeholder="Số nhà, tên đường, phường" />
          </div>

          <div class="sm:col-span-2">
            <label class="mb-1.5 block text-sm font-medium text-slate-700">Mô tả</label>
            <textarea formControlName="description" rows="3" [class]="input" placeholder="Có gì hay, hợp với cặp đôi thế nào…"></textarea>
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">Giá (VNĐ/người)</label>
            <div class="flex items-center gap-2">
              <input type="number" min="0" step="1000" formControlName="priceFrom" [class]="input" placeholder="Từ" />
              <span class="text-slate-400">–</span>
              <input type="number" min="0" step="1000" formControlName="priceTo" [class]="input" placeholder="Đến (nếu có)" />
            </div>
            @if (form.hasError('priceOrder')) {
              <p class="mt-1 text-xs text-rose-600">Giá đến phải lớn hơn hoặc bằng giá từ.</p>
            }
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">
              Giờ mở cửa <span class="font-normal text-slate-400">(trống = không cố định)</span>
            </label>
            <div class="flex items-center gap-2">
              <input type="time" formControlName="openTime" [class]="input" />
              <span class="text-slate-400">–</span>
              <input type="time" formControlName="closeTime" [class]="input" />
            </div>
            @if (form.hasError('halfHours')) {
              <p class="mt-1 text-xs text-rose-600">Nhập cả giờ mở và giờ đóng, hoặc bỏ trống cả hai.</p>
            }
          </div>

          <div class="sm:col-span-2">
            <label class="mb-1.5 block text-sm font-medium text-slate-700">Ghi chú giờ, giá</label>
            <input type="text" formControlName="hoursNote" [class]="input" placeholder="VD: Phố đi bộ chỉ mở tối thứ 6 đến chủ nhật" />
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">Thời lượng gợi ý (phút)</label>
            <input type="number" min="15" max="1440" step="15" formControlName="durationMin" [class]="input" placeholder="VD: 90" />
          </div>

          <div class="flex flex-col justify-end gap-2 pb-1">
            <label class="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" formControlName="indoor" class="h-4 w-4 rounded accent-brand-600" />
              Trong nhà (đi được khi trời mưa)
            </label>
            <label class="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" formControlName="needsBooking" class="h-4 w-4 rounded accent-brand-600" />
              Cần đặt trước
            </label>
          </div>

          @if (form.value.needsBooking) {
            <div class="sm:col-span-2">
              <label class="mb-1.5 block text-sm font-medium text-slate-700">Link đặt chỗ</label>
              <input type="url" formControlName="bookingUrl" [class]="input" placeholder="https://…" />
              @if (invalid('bookingUrl')) {
                <p class="mt-1 text-xs text-rose-600">Link phải bắt đầu bằng http:// hoặc https://</p>
              }
            </div>
          }

          <div class="sm:col-span-2">
            <label class="mb-1.5 block text-sm font-medium text-slate-700">Link Google Maps</label>
            <input
              type="url"
              formControlName="googleMapsUrl"
              (input)="syncCoordsFromLink()"
              [class]="input"
              placeholder="https://www.google.com/maps/…"
            />
          </div>
          <div class="sm:col-span-2">
            <label class="mb-1.5 block text-sm font-medium text-slate-700">
              Toạ độ <span class="font-normal text-slate-400">(không bắt buộc)</span>
            </label>
            <input type="text" formControlName="coordinates" [class]="input" placeholder="21.0287, 105.8524" />
            @if (coordinateError()) {
              <p class="mt-1 text-xs text-rose-600">Sai định dạng. Cần dạng <code>21.0287, 105.8524</code>.</p>
            }
          </div>
        </div>

        <app-photo-list-editor [(photos)]="photos" [(uploading)]="photosUploading" [maxSize]="1200" />
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
          {{ photosUploading() ? 'Đang tải ảnh…' : spot() ? 'Lưu thay đổi' : 'Thêm chỗ chơi' }}
        </button>
      </div>
    </app-modal>
  `,
})
export class SpotFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  /** null = thêm mới */
  readonly spot = input<SpotItem | null>(null);
  readonly districts = input.required<DistrictOption[]>();

  readonly save = output<SpotRequest>();
  readonly cancel = output<void>();

  protected readonly input = INPUT;
  protected readonly categories = SPOT_CATEGORIES;
  /** Nhiều ảnh (tối đa 6), ảnh đầu là ảnh bìa */
  protected readonly photos = signal<string[]>([]);
  /** Còn ảnh đang tải lên: chờ xong mới cho lưu */
  protected readonly photosUploading = signal(false);
  protected readonly coordinateError = signal(false);

  protected readonly form = this.fb.group(
    {
      category: this.fb.nonNullable.control<SpotCategory>('entertainment'),
      district: this.fb.nonNullable.control('', Validators.required),
      name: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]),
      address: this.fb.nonNullable.control(''),
      description: this.fb.nonNullable.control(''),
      priceFrom: this.fb.control<number | null>(0, Validators.min(0)),
      priceTo: this.fb.control<number | null>(null, Validators.min(0)),
      openTime: this.fb.nonNullable.control(''),
      closeTime: this.fb.nonNullable.control(''),
      hoursNote: this.fb.nonNullable.control(''),
      durationMin: this.fb.control<number | null>(null, [Validators.min(15), Validators.max(1440)]),
      indoor: this.fb.nonNullable.control(true),
      needsBooking: this.fb.nonNullable.control(false),
      bookingUrl: this.fb.nonNullable.control('', Validators.pattern(/^$|^https?:\/\/.+/)),
      googleMapsUrl: this.fb.nonNullable.control(''),
      coordinates: this.fb.nonNullable.control(''),
    },
    { validators: spotFormRules },
  );

  /** Mặc định "tự gán theo nhóm"; chỗ đã có nhãn Claude / admin thì giữ nhãn đó (ngOnInit) */
  protected readonly vibeChoice = signal<VibeChoice>({ vibes: [], auto: true });
  private readonly category = toSignal(this.form.controls.category.valueChanges, {
    initialValue: this.form.controls.category.value,
  });
  protected readonly defaultVibes = computed(() => defaultSpotVibes(this.category()));

  // Component được tạo mới mỗi lần mở modal nên nạp một lần ở ngOnInit là đủ.
  ngOnInit(): void {
    const s = this.spot();
    if (!s) return;
    if (s.vibesSource !== 'default') this.vibeChoice.set({ vibes: s.vibes, auto: false });
    this.form.patchValue({
      category: s.category,
      district: s.district,
      name: s.name,
      address: s.address,
      description: s.description,
      priceFrom: s.priceFrom,
      priceTo: s.priceTo,
      openTime: s.openTime ?? '',
      closeTime: s.closeTime ?? '',
      hoursNote: s.hoursNote,
      durationMin: s.durationMin,
      indoor: s.indoor,
      needsBooking: s.needsBooking,
      bookingUrl: s.bookingUrl,
      googleMapsUrl: s.googleMapsUrl,
      coordinates: s.lat !== null && s.lng !== null ? `${s.lat}, ${s.lng}` : '',
    });
    this.photos.set(s.photos?.length ? s.photos : s.imageUrl ? [s.imageUrl] : []);
  }

  protected invalid(control: string): boolean {
    const c = this.form.get(control);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  /** Link Google Maps đầy đủ thường có sẵn toạ độ: điền luôn nếu ô toạ độ đang trống. */
  protected syncCoordsFromLink(): void {
    const parsed = parseGmapUrl(this.form.getRawValue().googleMapsUrl.trim());
    if (parsed.lat !== null && parsed.lng !== null && !this.form.getRawValue().coordinates.trim()) {
      this.form.patchValue({ coordinates: `${parsed.lat}, ${parsed.lng}` });
    }
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.photosUploading()) return;
    const v = this.form.getRawValue();

    let lat: number | null = null;
    let lng: number | null = null;
    if (v.coordinates.trim()) {
      const parsed = parseGmapUrl(v.coordinates.trim());
      if (parsed.lat === null || parsed.lng === null) {
        this.coordinateError.set(true);
        return;
      }
      ({ lat, lng } = parsed);
    }
    this.coordinateError.set(false);

    this.save.emit({
      category: v.category,
      district: v.district,
      name: v.name.trim(),
      address: v.address.trim(),
      description: v.description.trim(),
      priceFrom: v.priceFrom ?? 0,
      priceTo: v.priceTo,
      openTime: v.openTime || null,
      closeTime: v.closeTime || null,
      hoursNote: v.hoursNote.trim(),
      durationMin: v.durationMin,
      indoor: v.indoor,
      needsBooking: v.needsBooking,
      bookingUrl: v.needsBooking ? v.bookingUrl.trim() : '',
      imageUrl: this.photos()[0] ?? '',
      photos: this.photos(),
      googleMapsUrl: v.googleMapsUrl.trim(),
      lat,
      lng,
      vibes: this.vibeChoice().auto ? this.defaultVibes() : this.vibeChoice().vibes,
      vibesAuto: this.vibeChoice().auto,
    });
  }
}
