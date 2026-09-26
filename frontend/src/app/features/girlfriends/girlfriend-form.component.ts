import { Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '../../shared/ui/modal.component';
import { ImagePickerComponent } from '../../shared/ui/image-picker.component';
import {
  Girlfriend,
  RELATIONSHIP_STATUSES,
} from '../../core/models/girlfriend.model';
import { nowIso, todayIso } from '../../core/utils/id';

@Component({
  selector: 'app-girlfriend-form',
  imports: [ReactiveFormsModule, ModalComponent, ImagePickerComponent],
  template: `
    <app-modal
      [title]="girlfriend() ? 'Sửa thông tin' : 'Thêm người yêu'"
      subtitle="Ghi lại những gì cần nhớ để khỏi lỡ dịp quan trọng"
      width="max-w-2xl"
      (dismiss)="cancel.emit()"
    >
      <form [formGroup]="form" class="space-y-5">
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">
              Họ tên <span class="text-rose-500">*</span>
            </label>
            <input
              type="text"
              formControlName="name"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              placeholder="VD: Nguyễn Thanh Mai"
            />
            @if (invalid('name')) {
              <p class="mt-1 text-xs text-rose-600">Họ tên tối thiểu 2 ký tự.</p>
            }
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">Biệt danh</label>
            <input
              type="text"
              formControlName="nickname"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              placeholder="Gọi ở nhà là gì?"
            />
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">Trạng thái</label>
            <select
              formControlName="status"
              class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
            >
              @for (s of statuses; track s.value) {
                <option [value]="s.value">{{ s.label }}</option>
              }
            </select>
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
            <label class="mb-1.5 block text-sm font-medium text-slate-700">Sinh nhật</label>
            <input
              type="date"
              formControlName="birthday"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">Ngày quen nhau</label>
            <input
              type="date"
              formControlName="startedDate"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div class="sm:col-span-2">
            <app-image-picker
              label="Ảnh đại diện"
              [value]="avatarUrl()"
              (valueChange)="avatarUrl.set($event)"
              [round]="true"
              [maxSize]="480"
            />
          </div>
        </div>

        <!-- Sở thích dạng chip -->
        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700">Sở thích</label>
          <div class="flex flex-wrap gap-2">
            @for (hobby of hobbies(); track hobby; let i = $index) {
              <span
                class="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-700"
              >
                {{ hobby }}
                <button
                  type="button"
                  class="text-brand-400 transition hover:text-brand-700"
                  (click)="removeHobby(i)"
                  aria-label="Xoá sở thích"
                >
                  ×
                </button>
              </span>
            }
          </div>
          <div class="mt-2 flex gap-2">
            <input
              type="text"
              [value]="hobbyDraft()"
              (input)="hobbyDraft.set($any($event.target).value)"
              (keydown.enter)="$event.preventDefault(); addHobby()"
              class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              placeholder="Nhập sở thích rồi Enter"
            />
            <button
              type="button"
              class="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              (click)="addHobby()"
            >
              Thêm
            </button>
          </div>
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700">Ghi chú</label>
          <textarea
            formControlName="note"
            rows="3"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            placeholder="Dị ứng gì, ghét gì, thích được tặng gì…"
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
          {{ girlfriend() ? 'Lưu thay đổi' : 'Thêm' }}
        </button>
      </div>
    </app-modal>
  `,
})
export class GirlfriendFormComponent {
  private readonly fb = inject(FormBuilder);

  readonly girlfriend = input<Girlfriend | null>(null);
  readonly save = output<Girlfriend>();
  readonly cancel = output<void>();

  protected readonly statuses = RELATIONSHIP_STATUSES;
  protected readonly hobbies = signal<string[]>([]);
  protected readonly hobbyDraft = signal('');
  /** Data URL của ảnh vừa upload, hoặc link ảnh ngoài */
  protected readonly avatarUrl = signal('');

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    nickname: [''],
    status: ['dating'],
    phone: ['', Validators.pattern(/^\d{9,11}$/)],
    birthday: [''],
    startedDate: [todayIso()],
    note: [''],
  });

  ngOnInit(): void {
    this.patchFromInput();
  }

  private patchFromInput(): void {
    const existing = this.girlfriend();
    if (!existing) return;
    this.form.patchValue({
      name: existing.name,
      nickname: existing.nickname,
      status: existing.status,
      phone: existing.phone,
      birthday: existing.birthday,
      startedDate: existing.startedDate,
      note: existing.note,
    });
    this.hobbies.set([...existing.hobbies]);
    this.avatarUrl.set(existing.avatarUrl);
  }

  protected invalid(control: string): boolean {
    const c = this.form.get(control);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  protected addHobby(): void {
    const value = this.hobbyDraft().trim();
    if (!value || this.hobbies().includes(value)) return;
    this.hobbies.update((list) => [...list, value]);
    this.hobbyDraft.set('');
  }

  protected removeHobby(index: number): void {
    this.hobbies.update((list) => list.filter((_, i) => i !== index));
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const v = this.form.getRawValue();
    const existing = this.girlfriend();

    this.save.emit({
      id: existing?.id ?? '',
      name: v.name.trim(),
      nickname: v.nickname.trim(),
      avatarUrl: this.avatarUrl().trim(),
      birthday: v.birthday,
      phone: v.phone.trim(),
      status: v.status as Girlfriend['status'],
      startedDate: v.startedDate,
      hobbies: this.hobbies(),
      note: v.note.trim(),
      version: existing?.version ?? 0,
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    });
  }
}
