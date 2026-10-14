import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, ElementRef, inject, input, model, signal, viewChild } from '@angular/core';
import { errorMessage } from '../../core/api/api';
import { ImagePurpose, UploadService } from '../../core/services/upload.service';
import { formatBytes } from '../../core/utils/image';
import { IconComponent } from './icon.component';

/**
 * Chọn ảnh từ máy (hoặc kéo thả), nén lại, upload lên server rồi trả về URL /uploads/...
 * Vẫn cho phép dán link ảnh ngoài như trước.
 */
@Component({
  selector: 'app-image-picker',
  imports: [IconComponent],
  template: `
    <label class="mb-1.5 block text-sm font-medium text-slate-700">{{ label() }}</label>

    @if (value()) {
      <div class="flex items-start gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <!-- Avatar cắt tròn nên dùng cover; ảnh quán hiện đầy đủ nên dùng contain -->
        <img
          [src]="value()"
          alt="Ảnh đã chọn"
          class="h-24 w-24 shrink-0 bg-white"
          [class]="round() ? 'rounded-full object-cover' : 'rounded-lg object-contain'"
        />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-slate-700">
            {{ isUploaded() ? 'Ảnh từ máy của bạn' : 'Ảnh từ đường dẫn' }}
          </p>
          <p class="mt-0.5 truncate text-xs text-slate-500">
            {{ isUploaded() ? sizeText() : value() }}
          </p>
          <div class="mt-2 flex gap-2">
            <button
              type="button"
              class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              (click)="fileInput.click()"
            >
              Đổi ảnh
            </button>
            <button
              type="button"
              class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
              (click)="clear()"
            >
              Xoá ảnh
            </button>
          </div>
        </div>
      </div>
    } @else {
      <div
        class="cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center transition"
        [class]="dragging() ? 'border-brand-400 bg-brand-50' : 'border-slate-300 hover:border-brand-300 hover:bg-slate-50'"
        (click)="fileInput.click()"
        (dragover)="onDragOver($event)"
        (dragleave)="dragging.set(false)"
        (drop)="onDrop($event)"
      >
        @if (busy()) {
          <!-- Hiện ngay ảnh vừa chọn (từ máy), upload chạy phía sau -->
          <div class="flex items-center justify-center gap-4">
            @if (preview(); as src) {
              <img [src]="src" alt="" class="h-20 w-20 shrink-0 bg-white opacity-70" [class]="round() ? 'rounded-full object-cover' : 'rounded-lg object-contain'" />
            }
            <div class="text-left">
              <p class="text-sm text-slate-500">
                {{ progress() === null ? 'Đang nén ảnh…' : 'Đang tải ảnh lên… ' + progress() + '%' }}
              </p>
              <div class="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-slate-200">
                <div class="h-full bg-brand-500 transition-all" [style.width.%]="progress() ?? 0"></div>
              </div>
            </div>
          </div>
        } @else {
          <p class="flex justify-center text-brand-500"><app-icon name="image" [size]="28" /></p>
          <p class="mt-1 text-sm font-medium text-slate-700">Chọn ảnh từ máy</p>
          <p class="mt-0.5 text-xs text-slate-500">
            Hoặc kéo thả ảnh vào đây · JPG, PNG, WebP
          </p>
        }
      </div>
    }

    <input
      #fileInput
      type="file"
      accept="image/*"
      class="hidden"
      (change)="onFileSelected($event)"
    />

    @if (error()) {
      <p class="mt-2 text-xs text-rose-600">{{ error() }}</p>
    }

    <!-- Vẫn giữ đường dẫn ngoài cho ai muốn dán link -->
    <details class="mt-2">
      <summary class="cursor-pointer text-xs text-slate-500 hover:text-slate-700">
        Hoặc dán đường dẫn ảnh
      </summary>
      <input
        type="url"
        [value]="isUploaded() ? '' : value()"
        (input)="value.set($any($event.target).value)"
        class="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        placeholder="https://…"
      />
    </details>
  `,
})
export class ImagePickerComponent {
  private readonly uploads = inject(UploadService);
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  /** Mở hộp chọn ảnh từ bên ngoài (vd. bấm vào ô trống của bộ chỉnh nhiều ảnh) */
  openFileDialog(): void {
    this.fileInput()?.nativeElement.click();
  }

  readonly value = model('');
  readonly label = input('Ảnh');
  readonly round = input(false);
  /** Cạnh dài nhất khi nén ở client — avatar nhỏ hơn ảnh quán */
  readonly maxSize = input(1200);
  /** Loại ảnh và tên gợi ý (tên quán, tên người…) để server đặt tên file dễ đọc */
  readonly purpose = input<ImagePurpose | undefined>(undefined);
  readonly nameHint = input('');

  protected readonly busy = signal(false);
  /** null = đang nén ở client, số = % đã upload */
  protected readonly progress = signal<number | null>(null);
  protected readonly dragging = signal(false);
  protected readonly error = signal('');
  /** Ảnh vừa chọn (object URL trên máy), hiện trong lúc upload */
  protected readonly preview = signal<string | null>(null);
  private readonly uploadedSize = signal<number | null>(null);

  protected readonly isUploaded = computed(() => this.value().startsWith('/uploads/'));
  protected readonly sizeText = computed(() => {
    const size = this.uploadedSize();
    return size === null ? 'Đã lưu trên server' : `Đã lưu trên server · ${formatBytes(size)}`;
  });

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) void this.handleFile(file);
    // Reset để chọn lại đúng file vừa xoá vẫn kích hoạt change
    input.value = '';
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) void this.handleFile(file);
  }

  protected clear(): void {
    this.value.set('');
    this.error.set('');
    this.uploadedSize.set(null);
  }

  /** Nén ở client (tiết kiệm băng thông) → upload thẳng lên storage → nhận URL công khai. */
  private async handleFile(file: File): Promise<void> {
    this.busy.set(true);
    this.progress.set(null);
    this.error.set('');
    const preview = URL.createObjectURL(file);
    this.preview.set(preview);
    try {
      const result = await this.uploads.uploadFile(file, this.maxSize(), (percent) => this.progress.set(percent), {
        purpose: this.purpose(),
        name: this.nameHint(),
      });
      this.value.set(result.url);
      this.uploadedSize.set(result.sizeBytes);
    } catch (err) {
      // Lỗi HTTP đã được errorInterceptor hiện toast; ở đây chỉ báo ngay dưới ô chọn ảnh
      this.error.set(err instanceof HttpErrorResponse ? errorMessage(err) : err instanceof Error ? err.message : 'Không xử lý được ảnh này.');
    } finally {
      this.busy.set(false);
      this.progress.set(null);
      this.preview.set(null);
      URL.revokeObjectURL(preview);
    }
  }
}
