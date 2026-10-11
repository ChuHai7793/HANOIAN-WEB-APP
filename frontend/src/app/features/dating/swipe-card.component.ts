import { Component, computed, input, output, signal } from '@angular/core';
import { Candidate } from '../../core/models/dating.model';

/** Kéo quá ngưỡng này (px) thì tính là quẹt. */
const SWIPE_THRESHOLD = 110;

/**
 * Thẻ hồ sơ quẹt được: kéo bằng chuột hoặc ngón tay (pointer events), sang phải = thích, sang trái =
 * bỏ qua. Thả trước ngưỡng thì thẻ trở lại giữa. Trang cha xử lý `swiped` (gọi API, bỏ thẻ).
 */
@Component({
  selector: 'app-swipe-card',
  template: `
    <div
      class="relative h-full w-full touch-none select-none overflow-hidden rounded-3xl bg-slate-200 shadow-xl"
      [style.transform]="transform()"
      [style.transition]="dragging() ? 'none' : 'transform 0.25s ease-out'"
      (pointerdown)="start($event)"
      (pointermove)="move($event)"
      (pointerup)="end()"
      (pointercancel)="end()"
    >
      @if (photo(); as url) {
        <img [src]="url" alt="" class="pointer-events-none h-full w-full object-cover" draggable="false" />
      } @else {
        <div class="flex h-full items-center justify-center text-6xl text-slate-400">🙂</div>
      }

      @if (photos().length > 1) {
        <div class="absolute inset-x-3 top-3 flex gap-1">
          @for (p of photos(); track $index) {
            <span class="h-1 flex-1 rounded-full" [class]="$index === photoIndex() ? 'bg-white' : 'bg-white/40'"></span>
          }
        </div>
        <!-- Chạm nửa trái / phải để xem ảnh trước / sau -->
        <button type="button" class="absolute inset-y-0 left-0 w-1/3" aria-label="Ảnh trước" (click)="prevPhoto()"></button>
        <button type="button" class="absolute inset-y-0 right-0 w-1/3" aria-label="Ảnh sau" (click)="nextPhoto()"></button>
      }

      <!-- Nhãn hiện ra khi kéo -->
      <span
        class="absolute left-5 top-8 -rotate-12 rounded-lg border-4 border-emerald-400 px-3 py-1 text-2xl font-black text-emerald-400"
        [style.opacity]="likeOpacity()"
        >THÍCH</span
      >
      <span
        class="absolute right-5 top-8 rotate-12 rounded-lg border-4 border-rose-400 px-3 py-1 text-2xl font-black text-rose-400"
        [style.opacity]="nopeOpacity()"
        >BỎ QUA</span
      >

      <div class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-5 text-white">
        <p class="text-2xl font-bold">
          {{ candidate().displayName }}<span class="font-normal">, {{ candidate().age }}</span>
        </p>
        @if (candidate().city) {
          <p class="text-sm opacity-90">📍 {{ candidate().city }}</p>
        }
        @if (candidate().bio) {
          <p class="mt-2 line-clamp-3 text-sm opacity-90">{{ candidate().bio }}</p>
        }
        @if (candidate().interests.length) {
          <div class="mt-2 flex flex-wrap gap-1.5">
            @for (i of candidate().interests; track i) {
              <span class="rounded-full bg-white/20 px-2 py-0.5 text-xs">{{ i }}</span>
            }
          </div>
        }
      </div>
    </div>
  `,
  host: { class: 'block h-full w-full' },
})
export class SwipeCardComponent {
  readonly candidate = input.required<Candidate>();
  /** true = thích, false = bỏ qua */
  readonly swiped = output<boolean>();

  protected readonly dx = signal(0);
  protected readonly dragging = signal(false);
  protected readonly photoIndex = signal(0);
  private startX = 0;
  private moved = false;

  /** Ảnh đại diện trước, rồi tới các ảnh khác (không lặp) */
  protected readonly photos = computed(() => {
    const c = this.candidate();
    return [c.avatarUrl, ...c.photos].filter((u, i, all): u is string => !!u && all.indexOf(u) === i);
  });
  protected readonly photo = computed(() => this.photos()[this.photoIndex()] ?? null);
  protected readonly transform = computed(() => `translateX(${this.dx()}px) rotate(${this.dx() / 20}deg)`);
  protected readonly likeOpacity = computed(() => Math.min(Math.max(this.dx() / SWIPE_THRESHOLD, 0), 1));
  protected readonly nopeOpacity = computed(() => Math.min(Math.max(-this.dx() / SWIPE_THRESHOLD, 0), 1));

  /** Nút ✖️ / ❤️ của trang cha: bay thẻ ra rồi báo quẹt */
  fling(liked: boolean): void {
    this.dx.set(liked ? 600 : -600);
    setTimeout(() => this.swiped.emit(liked), 200);
  }

  protected start(e: PointerEvent): void {
    this.dragging.set(true);
    this.moved = false;
    this.startX = e.clientX;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  protected move(e: PointerEvent): void {
    if (!this.dragging()) return;
    const dx = e.clientX - this.startX;
    if (Math.abs(dx) > 5) this.moved = true;
    this.dx.set(dx);
  }

  protected end(): void {
    if (!this.dragging()) return;
    this.dragging.set(false);
    const dx = this.dx();
    if (Math.abs(dx) >= SWIPE_THRESHOLD) this.fling(dx > 0);
    else this.dx.set(0);
  }

  protected prevPhoto(): void {
    if (this.moved) return;
    this.photoIndex.update((i) => Math.max(i - 1, 0));
  }

  protected nextPhoto(): void {
    if (this.moved) return;
    this.photoIndex.update((i) => Math.min(i + 1, this.photos().length - 1));
  }
}
