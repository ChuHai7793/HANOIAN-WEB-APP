import { Component, computed, input, output, signal } from '@angular/core';
import { Candidate } from '../../core/models/dating.model';

/** Kéo quá ngưỡng này (px) thì tính là quẹt. */
const SWIPE_THRESHOLD = 110;
/** Số tên quán hiện trong "Cùng lưu", còn lại gộp thành "+N" */
const SHARED_SHOWN = 2;

/**
 * Thẻ hồ sơ quẹt được: kéo bằng chuột hoặc ngón tay (pointer events), sang phải = thích, sang trái =
 * bỏ qua, lên trên = siêu thích (khi `canSuperLike`). Thả trước ngưỡng thì thẻ trở lại giữa. Trang cha xử
 * lý `swiped` / `superSwiped` (gọi API, bỏ thẻ).
 */
@Component({
  selector: 'app-swipe-card',
  template: `
    <article
      [attr.aria-label]="'Hồ sơ ' + candidate().displayName"
      class="relative touch-none select-none overflow-hidden rounded-[28px] border bg-white shadow-[0_2px_4px_rgba(48,30,110,0.05),0_24px_48px_rgba(48,30,110,0.10)]"
      [class]="candidate().superLikedMe ? 'border-2 border-[#2F80D9]' : 'border-slate-200'"
      [style.transform]="transform()"
      [style.transition]="dragging() ? 'none' : 'transform 0.25s ease-out'"
      (pointerdown)="start($event)"
      (pointermove)="move($event)"
      (pointerup)="end()"
      (pointercancel)="end()"
    >
      <div class="relative h-[clamp(150px,calc(100dvh-520px),420px)] bg-[#EFEAFC] lg:h-[clamp(200px,calc(100dvh-430px),420px)]">
        @if (photo(); as url) {
          <img [src]="url" alt="" class="pointer-events-none h-full w-full object-cover" draggable="false" />
        } @else {
          <div class="flex h-full flex-col items-center justify-center gap-3 text-brand-400">
            <svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" aria-hidden="true">
              <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
            </svg>
          </div>
        }

        @if (photos().length > 1) {
          <div class="absolute inset-x-4 top-3.5 flex gap-1.5">
            @for (p of photos(); track $index) {
              <span class="h-1 flex-1 rounded" [class]="$index === photoIndex() ? 'bg-brand-600' : 'bg-brand-300'"></span>
            }
          </div>
          <!-- Chạm nửa trái / phải để xem ảnh trước / sau -->
          <button type="button" class="absolute inset-y-0 left-0 w-1/3" aria-label="Ảnh trước" (click)="prevPhoto()"></button>
          <button type="button" class="absolute inset-y-0 right-0 w-1/3" aria-label="Ảnh sau" (click)="nextPhoto()"></button>
        }

        @if (candidate().superLikedMe) {
          <span class="absolute right-4 top-7 flex items-center gap-1 rounded-full bg-[#2F80D9] px-3 py-1.5 text-[13px] font-semibold text-white">
            ★ Đã siêu thích bạn
          </span>
        }
        @if (candidate().fit > 0) {
          <span class="absolute bottom-4 left-4 flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold text-brand-800">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" />
            </svg>
            Hợp gu {{ candidate().fit }}%
          </span>
        }

        <!-- Nhãn hiện ra khi kéo -->
        <span
          class="absolute left-1/2 top-1/3 -translate-x-1/2 rounded-lg border-4 border-[#2F80D9] bg-white/80 px-3 py-1 text-2xl font-black text-[#2F80D9]"
          [style.opacity]="superOpacity()"
          >SIÊU THÍCH</span
        >
        <span
          class="absolute left-5 top-8 -rotate-12 rounded-lg border-4 border-brand-600 bg-white/80 px-3 py-1 text-2xl font-black text-brand-600"
          [style.opacity]="likeOpacity()"
          >THÍCH</span
        >
        <span
          class="absolute right-5 top-8 rotate-12 rounded-lg border-4 border-slate-500 bg-white/80 px-3 py-1 text-2xl font-black text-slate-500"
          [style.opacity]="nopeOpacity()"
          >BỎ QUA</span
        >
      </div>

      <div class="pointer-events-none flex flex-col gap-2 px-5 pb-4 pt-3.5">
        <div class="flex flex-wrap items-baseline gap-2.5">
          <h2 class="text-[22px] font-extrabold tracking-tight text-slate-900">{{ candidate().displayName }}</h2>
          <span class="text-lg text-slate-600">{{ candidate().age }}</span>
          @if (candidate().city) {
            <span class="ml-auto flex items-center gap-1 text-[13px] text-slate-500">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              {{ candidate().city }}
            </span>
          }
        </div>
        @if (candidate().bio) {
          <p class="line-clamp-2 text-sm leading-snug text-slate-700">{{ candidate().bio }}</p>
        }
        @if (candidate().interests.length) {
          <div class="flex max-h-[26px] flex-wrap gap-1.5 overflow-hidden">
            @for (i of candidate().interests; track i) {
              <span class="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-medium text-brand-800">{{ i }}</span>
            }
          </div>
        }
        @if (sharedLabel(); as shared) {
          <div class="flex items-center gap-2 rounded-xl border border-dashed border-brand-300 px-3 py-2 text-xs text-slate-600">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6D4FD6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M17 8h1a4 4 0 1 1 0 8h-1" /><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z" />
            </svg>
            <span>Cùng lưu <b class="text-slate-900">{{ shared }}</b></span>
          </div>
        }
      </div>
    </article>
  `,
  host: { class: 'block' },
})
export class SwipeCardComponent {
  readonly candidate = input.required<Candidate>();
  /** Còn lượt siêu thích: kéo lên mới tính là siêu thích */
  readonly canSuperLike = input(false);
  /** true = thích, false = bỏ qua */
  readonly swiped = output<boolean>();
  readonly superSwiped = output<void>();

  protected readonly dx = signal(0);
  protected readonly dy = signal(0);
  protected readonly dragging = signal(false);
  protected readonly photoIndex = signal(0);
  private startX = 0;
  private startY = 0;
  private moved = false;

  /** Ảnh đại diện trước, rồi tới các ảnh khác (không lặp) */
  protected readonly photos = computed(() => {
    const c = this.candidate();
    return [c.avatarUrl, ...c.photos].filter((u, i, all): u is string => !!u && all.indexOf(u) === i);
  });
  protected readonly photo = computed(() => this.photos()[this.photoIndex()] ?? null);
  protected readonly transform = computed(
    () => `translate(${this.dx()}px, ${Math.min(this.dy(), 0)}px) rotate(${this.dx() / 20}deg)`,
  );
  /** Kéo lên rõ hơn kéo ngang */
  private readonly goingUp = computed(() => this.canSuperLike() && -this.dy() > Math.abs(this.dx()));
  protected readonly superOpacity = computed(() =>
    this.goingUp() ? Math.min(Math.max(-this.dy() / SWIPE_THRESHOLD, 0), 1) : 0,
  );
  /** "Cafe Cuối Ngõ, Echoes Café +1" (null khi không có quán chung) */
  protected readonly sharedLabel = computed(() => {
    const names = this.candidate().sharedPlaces.map((p) => p.name);
    if (!names.length) return null;
    const more = names.length - SHARED_SHOWN;
    return names.slice(0, SHARED_SHOWN).join(', ') + (more > 0 ? ` +${more}` : '');
  });
  protected readonly likeOpacity = computed(() =>
    this.goingUp() ? 0 : Math.min(Math.max(this.dx() / SWIPE_THRESHOLD, 0), 1),
  );
  protected readonly nopeOpacity = computed(() =>
    this.goingUp() ? 0 : Math.min(Math.max(-this.dx() / SWIPE_THRESHOLD, 0), 1),
  );

  /** Nút Bỏ qua / Thích của trang cha: bay thẻ ra rồi báo quẹt */
  fling(liked: boolean): void {
    this.dx.set(liked ? 600 : -600);
    setTimeout(() => this.swiped.emit(liked), 200);
  }

  /** Nút ★ của trang cha (hoặc kéo lên): bay thẻ lên rồi báo siêu thích */
  flingUp(): void {
    this.dx.set(0);
    this.dy.set(-800);
    setTimeout(() => this.superSwiped.emit(), 200);
  }

  protected start(e: PointerEvent): void {
    this.dragging.set(true);
    this.moved = false;
    this.startX = e.clientX;
    this.startY = e.clientY;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  protected move(e: PointerEvent): void {
    if (!this.dragging()) return;
    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) this.moved = true;
    this.dx.set(dx);
    this.dy.set(dy);
  }

  protected end(): void {
    if (!this.dragging()) return;
    this.dragging.set(false);
    const dx = this.dx();
    if (this.goingUp() && -this.dy() >= SWIPE_THRESHOLD) {
      this.flingUp();
      return;
    }
    this.dy.set(0);
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
