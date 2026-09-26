import { Component, computed, input, model, signal } from '@angular/core';
import {
  dataUrlBytes,
  fileToCompressedDataUrl,
  formatBytes,
} from '../../core/utils/image';

/**
 * Chọn ảnh từ máy (hoặc kéo thả), nén lại rồi trả về data URL.
 * Vẫn cho phép dán link ảnh ngoài như trước.
 */
@Component({
  selector: 'app-image-picker',
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
          <p class="text-sm text-slate-500">Đang xử lý ảnh…</p>
        } @else {
          <p class="text-2xl">🖼️</p>
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
  readonly value = model('');
  readonly label = input('Ảnh');
  readonly round = input(false);
  /** Cạnh dài nhất sau khi nén — avatar nhỏ hơn ảnh quán */
  readonly maxSize = input(800);

  protected readonly busy = signal(false);
  protected readonly dragging = signal(false);
  protected readonly error = signal('');

  protected readonly isUploaded = computed(() => this.value().startsWith('data:'));
  protected readonly sizeText = computed(() =>
    this.isUploaded() ? formatBytes(dataUrlBytes(this.value())) : '',
  );

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
  }

  private async handleFile(file: File): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      const dataUrl = await fileToCompressedDataUrl(file, { maxSize: this.maxSize() });
      this.value.set(dataUrl);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Không xử lý được ảnh này.');
    } finally {
      this.busy.set(false);
    }
  }
}
