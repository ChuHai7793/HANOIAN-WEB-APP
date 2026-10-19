import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, ElementRef, inject, input, model, OnDestroy, signal, viewChild } from '@angular/core';
import { errorMessage } from '../../core/api/api';
import { ImagePurpose, UploadService } from '../../core/services/upload.service';
import { IconComponent } from './icon.component';
import { ImagePickerComponent } from './image-picker.component';

/** Ảnh đang tải lên: hiện ngay bản trên máy, xong thì vào danh sách ảnh theo đúng thứ tự đã chọn */
interface PendingPhoto {
  id: number;
  preview: string;
  progress: number | null;
  url: string | null;
}

/** Số ảnh tải lên cùng lúc */
const PARALLEL_UPLOADS = 3;

/**
 * Admin quản lý ảnh của quán / chỗ chơi: thêm (tải lên hoặc dán link), xoá, đổi thứ tự. Ảnh đầu tiên là ảnh bìa.
 * Bấm ô trống chọn được nhiều ảnh một lần, tải song song; ảnh hiện ngay trong lúc tải.
 */
@Component({
  selector: 'app-photo-list-editor',
  imports: [IconComponent, ImagePickerComponent],
  template: `
    <div>
      <p class="mb-1.5 text-sm font-medium text-slate-700">
        Ảnh <span class="font-normal text-slate-400">({{ photos().length }}/{{ max() }}, ảnh đầu là ảnh bìa)</span>
      </p>
      <!-- Luôn đủ max ô: ô có ảnh + ô đang tải + ô trống (bấm để thêm), để thấy ngay giới hạn số ảnh -->
      <div class="mb-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
          @for (url of photos(); track url; let i = $index, first = $first, last = $last) {
            <div class="group relative aspect-square overflow-hidden rounded-lg bg-slate-100" [class.ring-2]="first" [class.ring-brand-500]="first">
              <img [src]="url" alt="" class="h-full w-full object-cover" />
              @if (first) {
                <span class="absolute left-1 top-1 rounded bg-brand-600 px-1.5 py-0.5 text-xs font-semibold text-white">Bìa</span>
              }
              <button type="button" class="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white" (click)="remove(i)" aria-label="Bỏ ảnh">
                <app-icon name="close" [size]="13" />
              </button>
              <div class="absolute inset-x-1 bottom-1 flex justify-between">
                <button type="button" class="flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white disabled:opacity-0" [disabled]="first" (click)="move(i, -1)" aria-label="Lên trước">
                  <span class="rotate-180"><app-icon name="arrowRight" [size]="13" /></span>
                </button>
                <button type="button" class="flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white disabled:opacity-0" [disabled]="last || uploading()" (click)="move(i, 1)" aria-label="Xuống sau">
                  <app-icon name="arrowRight" [size]="13" />
                </button>
              </div>
            </div>
          }
          @for (p of queue(); track p.id) {
            <div class="relative aspect-square overflow-hidden rounded-lg bg-slate-100">
              <img [src]="p.preview" alt="" class="h-full w-full object-cover opacity-60" />
              <div class="absolute inset-x-2 bottom-2 h-1.5 overflow-hidden rounded-full bg-white/70">
                <div class="h-full bg-brand-500 transition-all" [style.width.%]="p.url ? 100 : (p.progress ?? 0)"></div>
              </div>
            </div>
          }
          @for (slot of emptySlots(); track slot; let firstEmpty = $first) {
            <button
              type="button"
              class="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-xs transition"
              [class]="firstEmpty ? 'border-brand-300 bg-brand-50/60 text-brand-600 hover:bg-brand-50' : 'border-slate-200 text-slate-300 hover:border-brand-200 hover:text-brand-400'"
              [attr.aria-label]="'Thêm ảnh ' + slot"
              (click)="openFiles()"
            >
              <app-icon name="plus" [size]="firstEmpty ? 20 : 16" />
              @if (firstEmpty) {
                <span class="font-medium">{{ photos().length || queue().length ? 'Thêm ảnh' : 'Ảnh bìa' }}</span>
              } @else {
                <span>{{ slot }}</span>
              }
            </button>
          }
      </div>
      <input #files type="file" accept="image/*" multiple class="hidden" (change)="onFilesSelected($event)" />
      @if (error()) {
        <p class="mb-2 text-xs text-rose-600">{{ error() }}</p>
      }
      @if (photos().length + queue().length < max()) {
        <app-image-picker label="Thêm ảnh" [value]="pendingLink()" (valueChange)="add($event)" [maxSize]="maxSize()" [purpose]="purpose()" [nameHint]="nameHint()" />
      }
    </div>
  `,
})
export class PhotoListEditorComponent implements OnDestroy {
  private readonly uploads = inject(UploadService);

  readonly photos = model.required<string[]>();
  readonly max = input(6);
  /** Cạnh dài tối đa khi thu nhỏ ảnh tải lên */
  readonly maxSize = input(1200);
  /** Loại ảnh và tên gợi ý (tên quán / chỗ chơi) để server đặt tên file dễ đọc */
  readonly purpose = input<ImagePurpose | undefined>(undefined);
  readonly nameHint = input('');
  /** true khi còn ảnh đang tải: form nên chờ rồi mới cho lưu */
  readonly uploading = model(false);

  private readonly files = viewChild<ElementRef<HTMLInputElement>>('files');
  protected readonly queue = signal<PendingPhoto[]>([]);
  protected readonly error = signal('');
  private nextId = 0;

  /** Số thứ tự các ô còn trống (ví dụ có 2 ảnh, tối đa 6 → [3, 4, 5, 6]) */
  protected readonly emptySlots = computed(() => {
    const used = this.photos().length + this.queue().length;
    return Array.from({ length: Math.max(0, this.max() - used) }, (_, i) => used + i + 1);
  });

  /** Ô dán link: đặt lại sau mỗi lần thêm */
  protected readonly pendingLink = signal('');

  ngOnDestroy(): void {
    for (const p of this.queue()) URL.revokeObjectURL(p.preview);
  }

  protected openFiles(): void {
    this.files()?.nativeElement.click();
  }

  protected onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const free = this.max() - this.photos().length - this.queue().length;
    const chosen = Array.from(input.files ?? []).filter((f) => f.type.startsWith('image/'));
    input.value = '';
    if (!chosen.length) return;
    this.error.set(chosen.length > free ? `Chỉ thêm được ${free} ảnh nữa (tối đa ${this.max()}).` : '');
    void this.uploadAll(chosen.slice(0, free));
  }

  /** Tải song song tối đa {@link PARALLEL_UPLOADS} ảnh; ảnh nào xong cũng chờ ảnh chọn trước nó để giữ thứ tự */
  private async uploadAll(files: File[]): Promise<void> {
    const items = files.map((file) => ({ file, pending: { id: this.nextId++, preview: URL.createObjectURL(file), progress: null, url: null } as PendingPhoto }));
    this.queue.update((q) => [...q, ...items.map((i) => i.pending)]);
    this.uploading.set(true);

    let next = 0;
    const worker = async () => {
      while (next < items.length) {
        const { file, pending } = items[next++];
        try {
          const result = await this.uploads.uploadFile(file, this.maxSize(), (percent) => this.patch(pending.id, { progress: percent }), {
            purpose: this.purpose(),
            name: this.nameHint(),
          });
          // Tải sẵn ảnh trên server rồi mới thay ảnh xem trước, để ô ảnh không bị trắng lúc chuyển
          await preload(result.url);
          this.patch(pending.id, { url: result.url });
        } catch (err) {
          this.error.set(err instanceof HttpErrorResponse ? errorMessage(err) : err instanceof Error ? err.message : 'Không tải được ảnh này.');
          this.drop(pending.id);
        }
        this.flush();
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL_UPLOADS, items.length) }, worker));
  }

  private patch(id: number, change: Partial<PendingPhoto>): void {
    this.queue.update((q) => q.map((p) => (p.id === id ? { ...p, ...change } : p)));
  }

  private drop(id: number): void {
    const p = this.queue().find((x) => x.id === id);
    if (p) URL.revokeObjectURL(p.preview);
    this.queue.update((q) => q.filter((x) => x.id !== id));
  }

  /** Chuyển các ảnh đầu hàng đợi đã tải xong vào danh sách ảnh */
  private flush(): void {
    const q = this.queue();
    let done = 0;
    while (done < q.length && q[done].url) done++;
    if (done) {
      const urls = q.slice(0, done).map((p) => p.url!).filter((u) => !this.photos().includes(u));
      this.photos.update((list) => [...list, ...urls].slice(0, this.max()));
      q.slice(0, done).forEach((p) => URL.revokeObjectURL(p.preview));
      this.queue.set(q.slice(done));
    }
    this.uploading.set(this.queue().length > 0);
  }

  protected add(url: string): void {
    const u = url.trim();
    if (u && !this.photos().includes(u) && this.photos().length + this.queue().length < this.max()) {
      this.photos.update((list) => [...list, u]);
    }
    this.pendingLink.set(u);
    setTimeout(() => this.pendingLink.set(''));
  }

  protected remove(index: number): void {
    this.photos.update((list) => list.filter((_, i) => i !== index));
  }

  protected move(index: number, delta: -1 | 1): void {
    this.photos.update((list) => {
      const next = [...list];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });
  }
}

function preload(url: string): Promise<void> {
  const img = new Image();
  img.src = url;
  return img.decode().catch(() => undefined);
}
