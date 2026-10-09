import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { errorCode, problemOf } from '../../core/api/api';
import { AuthService } from '../../core/auth/auth.service';
import { Gender, GENDERS, Profile } from '../../core/models/profile.model';
import { ProfileService } from '../../core/services/profile.service';
import { ToastService } from '../../core/services/toast.service';
import { ImagePickerComponent } from '../../shared/ui/image-picker.component';
import { todayIso } from '../../core/utils/id';

/**
 * Form hồ sơ cá nhân, dùng chung cho trang "Hoàn thiện hồ sơ" (ngay sau khi đăng ký, có nút
 * "Để sau") và trang "Hồ sơ của tôi". Tự tải hồ sơ hiện tại khi mở.
 */
@Component({
  selector: 'app-profile-form',
  imports: [ReactiveFormsModule, ImagePickerComponent],
  template: `
    @if (loading()) {
      <p class="text-sm text-slate-500">Đang tải hồ sơ…</p>
    } @else {
      <form [formGroup]="form" class="space-y-5" (ngSubmit)="save()">
        <app-image-picker
          label="Ảnh đại diện"
          [value]="avatarUrl()"
          (valueChange)="avatarUrl.set($event)"
          [round]="true"
          [maxSize]="480"
        />

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <label class="mb-1.5 block text-sm font-medium text-slate-700">
              Tên hiển thị <span class="text-rose-500">*</span>
            </label>
            <input
              type="text"
              formControlName="displayName"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            @if (invalid('displayName')) {
              <p class="mt-1 text-xs text-rose-600">Nhập tên hiển thị (tối đa 80 ký tự).</p>
            }
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">Giới tính</label>
            <select
              formControlName="gender"
              class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
            >
              <option value="">Không chọn</option>
              @for (g of genders; track g.value) {
                <option [value]="g.value">{{ g.label }}</option>
              }
            </select>
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">Ngày sinh</label>
            <input
              type="date"
              formControlName="birthday"
              [max]="today"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">Số điện thoại</label>
            <input
              type="tel"
              formControlName="phone"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              placeholder="09xxxxxxxx"
            />
            @if (invalid('phone')) {
              <p class="mt-1 text-xs text-rose-600">Số điện thoại 9–11 chữ số.</p>
            }
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">Thành phố</label>
            <input
              type="text"
              formControlName="city"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              placeholder="VD: Hà Nội"
            />
          </div>

          <div class="sm:col-span-2">
            <label class="mb-1.5 block text-sm font-medium text-slate-700">Giới thiệu ngắn</label>
            <textarea
              rows="3"
              formControlName="bio"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              placeholder="Đôi dòng về bạn"
            ></textarea>
            <p class="mt-1 text-right text-xs text-slate-400">{{ form.controls.bio.value.length }}/500</p>
          </div>
        </div>

        <p class="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Thông tin hồ sơ được lưu trong hệ thống và quản trị viên có thể xem. Chỉ điền những gì bạn
          muốn chia sẻ.
        </p>

        <div class="flex flex-wrap justify-end gap-2">
          @if (skippable()) {
            <button
              type="button"
              class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              (click)="done.emit()"
            >
              Để sau
            </button>
          }
          <button
            type="submit"
            class="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            [disabled]="saving()"
          >
            {{ saving() ? 'Đang lưu…' : 'Lưu hồ sơ' }}
          </button>
        </div>
      </form>
    }
  `,
})
export class ProfileFormComponent implements OnInit {
  private readonly profiles = inject(ProfileService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  /** Hiện nút "Để sau" (trang hoàn thiện hồ sơ ngay sau khi đăng ký). */
  readonly skippable = input(false);
  /** Lưu xong, hoặc bấm "Để sau". */
  readonly done = output<void>();

  protected readonly genders = GENDERS;
  protected readonly today = todayIso();
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly avatarUrl = signal('');
  private version: number | null = null;

  protected readonly form = inject(FormBuilder).nonNullable.group({
    displayName: ['', [Validators.required, Validators.maxLength(80)]],
    gender: [''],
    birthday: [''],
    phone: ['', Validators.pattern(/^\d{9,11}$/)],
    city: ['', Validators.maxLength(80)],
    bio: ['', Validators.maxLength(500)],
  });

  async ngOnInit(): Promise<void> {
    try {
      this.apply(await this.profiles.get());
    } finally {
      this.loading.set(false);
    }
  }

  protected invalid(control: 'displayName' | 'phone'): boolean {
    const c = this.form.controls[control];
    return c.invalid && (c.dirty || c.touched);
  }

  protected async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.saving.set(true);
    try {
      const saved = await this.profiles.save({
        displayName: v.displayName.trim(),
        avatarUrl: this.avatarUrl() || null,
        birthday: v.birthday || null,
        gender: (v.gender || null) as Gender | null,
        phone: v.phone.trim() || null,
        city: v.city.trim() || null,
        bio: v.bio.trim(),
        version: this.version,
      });
      this.apply(saved);
      this.auth.updateProfile(saved.displayName, saved.avatarUrl);
      this.toast.success('Đã lưu hồ sơ.');
      this.done.emit();
    } catch (err) {
      // Hồ sơ vừa được sửa ở thiết bị khác: nạp bản mới nhất để người dùng xem lại rồi lưu
      if (errorCode(err) === 'VERSION_CONFLICT') {
        const current = problemOf(err)?.current as Profile | undefined;
        if (current) this.apply(current);
        this.toast.error('Hồ sơ vừa được sửa ở thiết bị khác. Đã tải lại bản mới nhất, hãy kiểm tra rồi lưu lại.');
      }
      // Lỗi khác: errorInterceptor đã hiện thông báo
    } finally {
      this.saving.set(false);
    }
  }

  private apply(p: Profile): void {
    this.version = p.version;
    this.avatarUrl.set(p.avatarUrl ?? '');
    this.form.reset({
      displayName: p.displayName,
      gender: p.gender ?? '',
      birthday: p.birthday ?? '',
      phone: p.phone ?? '',
      city: p.city ?? '',
      bio: p.bio ?? '',
    });
  }
}
