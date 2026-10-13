import { Component, input, model, signal } from '@angular/core';
import { IconComponent } from './icon.component';
import { ImagePickerComponent } from './image-picker.component';

/**
 * Admin quản lý ảnh của quán / chỗ chơi: thêm (tải lên hoặc dán link), xoá, đổi thứ tự. Ảnh đầu tiên là ảnh bìa.
 */
@Component({
  selector: 'app-photo-list-editor',
  imports: [IconComponent, ImagePickerComponent],
  template: `
    <div>
      <p class="mb-1.5 text-sm font-medium text-slate-700">
        Ảnh <span class="font-normal text-slate-400">({{ photos().length }}/{{ max() }}, ảnh đầu là ảnh bìa)</span>
      </p>
      @if (photos().length) {
        <div class="mb-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
          @for (url of photos(); track url; let i = $index, first = $first, last = $last) {
            <div class="group relative aspect-square overflow-hidden rounded-lg bg-slate-100" [class.ring-2]="first" [class.ring-brand-500]="first">
              <img [src]="url" alt="" class="h-full w-full object-cover" />
              @if (first) {
                <span class="absolute left-1 top-1 rounded bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">Bìa</span>
              }
              <button type="button" class="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white" (click)="remove(i)" aria-label="Bỏ ảnh">
                <app-icon name="close" [size]="13" />
              </button>
              <div class="absolute inset-x-1 bottom-1 flex justify-between">
                <button type="button" class="flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white disabled:opacity-0" [disabled]="first" (click)="move(i, -1)" aria-label="Lên trước">
                  <span class="rotate-180"><app-icon name="arrowRight" [size]="13" /></span>
                </button>
                <button type="button" class="flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white disabled:opacity-0" [disabled]="last" (click)="move(i, 1)" aria-label="Xuống sau">
                  <app-icon name="arrowRight" [size]="13" />
                </button>
              </div>
            </div>
          }
        </div>
      }
      @if (photos().length < max()) {
        <app-image-picker label="Thêm ảnh" [value]="pending()" (valueChange)="add($event)" [maxSize]="maxSize()" />
      }
    </div>
  `,
})
export class PhotoListEditorComponent {
  readonly photos = model.required<string[]>();
  readonly max = input(6);
  /** Cạnh dài tối đa khi thu nhỏ ảnh tải lên */
  readonly maxSize = input(1200);

  /** Ô thêm ảnh: đặt lại sau mỗi lần thêm */
  protected readonly pending = signal('');

  protected add(url: string): void {
    const u = url.trim();
    if (u && !this.photos().includes(u) && this.photos().length < this.max()) {
      this.photos.update((list) => [...list, u]);
    }
    this.pending.set(u);
    setTimeout(() => this.pending.set(''));
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
