import { afterNextRender, afterRenderEffect, Component, computed, DestroyRef, ElementRef, inject, input, OnInit, output, signal, viewChild } from '@angular/core';
import { imageVariant } from '../../core/models/place.model';
import { IconComponent } from './icon.component';

/** Một thẻ nổi bật (quán hoặc chỗ chơi), trang cha dựng từ dữ liệu của mình */
export interface FeaturedCard {
  /** id quán / chỗ chơi, trả lại qua (open) */
  id: string;
  position: number;
  /** Dòng nhỏ phía trên, vd. "Một chút bình yên" */
  kicker: string;
  /** Câu dẫn lớn, xuống dòng bằng \n */
  headline: string;
  imageUrl: string | null;
  /** Dòng nhỏ trên câu dẫn, vd. "Cafe · Ba Đình" */
  meta: string;
  name: string;
  /** Điểm đánh giá đã định dạng ("4,6"), null = chưa có */
  rating: string | null;
  /** Thông tin thêm sau tên, vd. giá "Từ 40k" */
  note: string | null;
}

/** Kéo quá chừng này (px) thì coi là kéo, không phải bấm mở */
const DRAG_THRESHOLD = 6;
/** Tự trượt 1 thẻ sau mỗi khoảng này */
const AUTOPLAY_MS = 3000;
/** Người dùng vừa chạm / kéo / bấm ‹ ›: chờ chừng này rồi mới tự trượt tiếp */
const RESUME_MS = 3000;

interface Slide {
  key: string;
  card: FeaturedCard;
  /** Bản sao (bộ đầu / cuối của vòng tròn): ẩn với trình đọc màn hình, không nhận Tab */
  clone: boolean;
}

/**
 * Khối "nổi bật" ở đầu Khám phá quán / Tìm chỗ chơi: tiêu đề, nút admin "Chọn gợi ý nổi bật", nút ẩn / hiện
 * (nhớ theo trình duyệt) và tối đa 10 thẻ admin chọn, xếp một hàng ngang trượt được. Màn rộng ~3 thẻ / khung,
 * máy tính bảng ~2, điện thoại ~1,2. Xem tiếp bằng nút ‹ ›, giữ chuột rồi kéo, vuốt hoặc lăn ngang; thẻ dừng
 * ngay ngắn (scroll snap). Bấm thẻ (không kéo) mở chi tiết.
 * Thẻ tràn khỏi khung: vòng tròn liên tục (thẻ 1 nối sau thẻ cuối) và tự trượt 1 thẻ mỗi 3 giây; dừng khi rê
 * chuột / chạm / kéo / bấm ‹ › (chạy lại sau 3 giây) hoặc khi tab bị ẩn.
 */
@Component({
  selector: 'app-featured-section',
  imports: [IconComponent],
  template: `
    @if (cards().length || canEdit()) {
      <div class="mt-2 flex flex-wrap items-center gap-x-3 text-[13px] font-medium">
        <h2 class="mr-auto text-lg font-bold tracking-tight text-slate-900">{{ heading() }}</h2>
        @if (canEdit()) {
          <button type="button" class="min-h-9 px-1 text-brand-700 hover:underline" (click)="edit.emit()">Chọn gợi ý nổi bật</button>
        }
        @if (cards().length) {
          <button type="button" class="flex min-h-9 items-center gap-1 px-1 text-slate-500 hover:text-slate-800" (click)="toggle()">
            {{ hidden() ? 'Hiện gợi ý nổi bật' : 'Ẩn gợi ý nổi bật' }}
            <span class="transition" [class.rotate-180]="!hidden()"><app-icon name="chevronDown" [size]="14" /></span>
          </button>
        }
      </div>
    }
    <div class="relative" [class.hidden]="!cards().length || hidden()" (mouseenter)="hovering = true" (mouseleave)="hovering = false; pause()" (focusin)="pause()">
      <div
        #track
        class="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
        [class.cursor-grab]="canScroll()"
        [class.!cursor-grabbing]="dragging()"
        [class.!snap-none]="dragging()"
        [class.!scroll-auto]="dragging()"
        (pointerdown)="dragStart($event)"
        (scroll)="onScroll()"
      >
        <!-- Vòng tròn: 3 bộ thẻ nối nhau (bộ giữa là thật, 2 bộ hai bên là bản sao để trượt mãi không hết) -->
        @for (s of slides(); track s.key) {
          @let f = s.card;
          <button
            type="button"
            [attr.aria-hidden]="s.clone ? 'true' : null"
            [attr.tabindex]="s.clone ? -1 : null"
            class="group relative block h-[180px] w-[82%] shrink-0 snap-start overflow-hidden rounded-2xl text-left sm:h-[230px] sm:w-[calc((100%-1rem)/2)] md:h-[290px] xl:w-[calc((100%-2rem)/3)]"
            [attr.aria-label]="'Xem ' + f.name"
            (click)="onCardClick($event, f.id)"
            (dragstart)="$event.preventDefault()"
          >
            @if (f.imageUrl) {
              <img [src]="f.imageUrl" [attr.srcset]="srcset(f.imageUrl)" [attr.sizes]="srcset(f.imageUrl) ? '(min-width: 80rem) 400px, (min-width: 40rem) 50vw, 82vw' : null" alt="" draggable="false" decoding="async" (error)="imageFailed(f.imageUrl)" class="pointer-events-none absolute inset-0 h-full w-full select-none object-cover transition duration-500 group-hover:scale-105" />
            } @else {
              <span class="absolute inset-0 bg-gradient-to-br from-brand-500 to-brand-800"></span>
            }
            <span class="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10"></span>
            <!-- Mép trên tối nhẹ: dòng chữ nhỏ vẫn đọc được trên ảnh sáng -->
            <span class="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/55 to-transparent"></span>
            @if (f.kicker) {
              <span class="absolute inset-x-5 top-4 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-white [text-shadow:0_1px_6px_rgb(0_0_0/0.45)] md:inset-x-6 md:top-5 md:text-[13px]">
                @if (f.position === 1) {
                  <span class="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
                }
                {{ f.kicker }}
              </span>
            }
            <span class="absolute inset-x-4 bottom-3.5 block pr-12 sm:inset-x-5 sm:bottom-4 md:inset-x-6 md:bottom-5">
              <span class="block text-[12px] font-semibold uppercase tracking-[0.14em] text-white/75 md:text-[13px]">{{ f.meta }}</span>
              <span class="mt-1 block whitespace-pre-line text-[19px] font-bold leading-tight text-white sm:text-[22px] md:text-[26px]">{{ f.headline }}</span>
              <span class="mt-2 block text-sm text-white/85">
                {{ f.name }}
                @if (f.rating) {
                  · <span class="text-amber-300">★</span> {{ f.rating }}
                }
                @if (f.note) {
                  · {{ f.note }}
                }
              </span>
            </span>
            <span class="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-800 transition group-hover:bg-white md:bottom-5 md:right-5 md:h-11 md:w-11">
              <span class="-rotate-45"><app-icon name="arrowRight" [size]="16" [stroke]="2.2" /></span>
            </span>
          </button>
        }
      </div>

      <!-- Nút trượt: màn rộng (điện thoại vuốt) -->
      @if (canScroll()) {
        <button
          type="button"
          class="absolute left-0 top-1/2 hidden h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-md transition hover:bg-white disabled:pointer-events-none disabled:opacity-0 md:flex"
          [attr.aria-label]="heading() + ' trước'"
          [disabled]="atStart()"
          (click)="page(-1)"
        >
          <span class="rotate-180"><app-icon name="arrowRight" [size]="18" [stroke]="2.2" /></span>
        </button>
        <button
          type="button"
          class="absolute right-0 top-1/2 hidden h-11 w-11 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-md transition hover:bg-white disabled:pointer-events-none disabled:opacity-0 md:flex"
          [attr.aria-label]="heading() + ' sau'"
          [disabled]="atEnd()"
          (click)="page(1)"
        >
          <app-icon name="arrowRight" [size]="18" [stroke]="2.2" />
        </button>
      }
    </div>
  `,
})
export class FeaturedSectionComponent implements OnInit {
  readonly heading = input.required<string>();
  readonly cards = input.required<FeaturedCard[]>();
  readonly canEdit = input(false);
  /** Khoá localStorage nhớ "ẩn gợi ý nổi bật" của trang */
  readonly storageKey = input.required<string>();
  readonly open = output<string>();
  readonly edit = output<void>();

  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  protected readonly hidden = signal(false);
  protected readonly canScroll = signal(false);
  protected readonly atStart = signal(true);
  protected readonly atEnd = signal(false);
  protected readonly dragging = signal(false);
  /** Thẻ tràn khỏi khung: chạy vòng tròn (3 bộ thẻ) và tự trượt */
  protected readonly loop = signal(false);

  protected readonly slides = computed<Slide[]>(() => {
    const cards = this.cards();
    const copy = (n: number) => cards.map((card) => ({ key: `${n}:${card.id}`, card, clone: n !== 1 }));
    return this.loop() ? [...copy(0), ...copy(1), ...copy(2)] : copy(1);
  });

  /** Chuột đang ở trên khối: không tự trượt */
  protected hovering = false;
  /** Không tự trượt trước thời điểm này (người dùng vừa tương tác) */
  private pausedUntil = 0;
  /** Vừa bật vòng tròn: nhảy tới bộ thẻ giữa sau khi vẽ xong */
  private needsCenter = false;
  private settleTimer: ReturnType<typeof setTimeout> | undefined;

  private dragX = 0;
  private dragScroll = 0;
  private moved = 0;

  /** Hàng thẻ đang trong khung nhìn: chỉ tự trượt khi người dùng thấy nó (đỡ tốn pin, không giật trang khi đã cuộn qua) */
  private inView = true;
  /** Cảm ứng + người dùng tắt hiệu ứng chuyển động trong máy: không tự trượt */
  private reducedMotion = false;
  /** Ảnh mà bản thu nhỏ không tải được: dùng ảnh gốc */
  private readonly failed = signal<ReadonlySet<string>>(new Set());

  /** Bản thu nhỏ 800px (và 320px) cho thẻ; null nếu không phải ảnh của app hoặc đã lỗi */
  protected srcset(url: string): string | null {
    if (this.failed().has(url)) return null;
    const small = imageVariant(url, 320);
    const medium = imageVariant(url, 800);
    return small && medium ? `${small} 320w, ${medium} 800w, ${url} 1200w` : null;
  }

  protected imageFailed(url: string): void {
    if (this.srcset(url)) this.failed.update((s) => new Set(s).add(url));
  }

  constructor() {
    const destroyRef = inject(DestroyRef);
    // Chỉ trên trình duyệt: đo xem hàng có tràn ngang không, theo dõi khi đổi cỡ; tự trượt
    afterNextRender(() => {
      this.updateArrows();
      const el = this.track().nativeElement;
      const observer = new ResizeObserver(() => requestAnimationFrame(() => this.updateArrows()));
      observer.observe(el);
      const visibility = new IntersectionObserver(([entry]) => (this.inView = !!entry?.isIntersecting), { threshold: 0.3 });
      visibility.observe(el);
      // Máy tính: vẫn trượt dù hệ điều hành tắt hiệu ứng (nhiều máy Windows tắt "Animation effects" mà người dùng
      // không biết). Điện thoại: tôn trọng cài đặt giảm chuyển động của người dùng.
      this.reducedMotion = window.matchMedia?.('(hover: none) and (prefers-reduced-motion: reduce)').matches ?? false;
      const timer = setInterval(() => this.autoplay(), AUTOPLAY_MS);
      destroyRef.onDestroy(() => {
        observer.disconnect();
        visibility.disconnect();
        clearInterval(timer);
        clearTimeout(this.settleTimer);
      });
    });
    // Danh sách đổi (admin vừa thêm / bớt), vừa hiện lại hoặc vừa bật vòng tròn: đo lại
    afterRenderEffect(() => {
      this.slides();
      this.hidden();
      this.updateArrows();
      if (this.loop() && this.needsCenter) {
        this.needsCenter = false;
        const el = this.track().nativeElement;
        this.jump(el.scrollLeft + this.setWidth());
      }
    });
  }

  ngOnInit(): void {
    try {
      this.hidden.set(localStorage.getItem(this.storageKey()) === '1');
    } catch {
      // Render trên server, ẩn danh / chặn lưu trữ: mặc định hiện
    }
  }

  protected toggle(): void {
    this.hidden.update((v) => !v);
    try {
      localStorage.setItem(this.storageKey(), this.hidden() ? '1' : '0');
    } catch {
      // Chỉ không nhớ được lựa chọn
    }
  }

  /** Trượt gần một khung (số thẻ đang thấy) sang trái / phải; snap tự canh thẻ */
  protected page(direction: -1 | 1): void {
    this.pause();
    const el = this.track().nativeElement;
    this.slide(direction * el.clientWidth * 0.9);
  }

  /** Người dùng vừa tương tác: tạm dừng tự trượt */
  protected pause(): void {
    this.pausedUntil = Date.now() + RESUME_MS;
  }

  protected updateArrows(): void {
    if (this.hidden() || !this.cards().length) return; // đang ẩn: không đo được
    const el = this.track().nativeElement;
    if (this.loop()) {
      // Đổi cỡ màn hình làm mọi thẻ vừa khung: thôi vòng tròn
      if (this.setWidth() <= el.clientWidth + 2) {
        this.loop.set(false);
        this.jump(0);
        return;
      }
      this.canScroll.set(true);
      this.atStart.set(false);
      this.atEnd.set(false);
      return;
    }
    const max = el.scrollWidth - el.clientWidth;
    this.canScroll.set(max > 2);
    this.atStart.set(el.scrollLeft <= 2);
    this.atEnd.set(el.scrollLeft >= max - 2);
    if (max > 2 && this.cards().length > 1) {
      this.needsCenter = true;
      this.loop.set(true);
    }
  }

  protected onScroll(): void {
    if (!this.loop()) this.updateArrows();
    // Dừng trượt xong (nút, vuốt, tự trượt): trượt ra bộ bản sao thì nhảy về bộ giữa, mắt không thấy
    clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => this.recenter(), 150);
  }

  /** Bề rộng một bộ thẻ (gồm khoảng cách), = khoảng cách giữa thẻ đầu của bộ 1 và bộ 2 */
  private setWidth(): number {
    const items = this.track().nativeElement.children as HTMLCollectionOf<HTMLElement>;
    const n = this.cards().length;
    return items.length >= 2 * n ? items[n].offsetLeft - items[0].offsetLeft : 0;
  }

  /** Bước một thẻ */
  private cardStep(): number {
    const items = this.track().nativeElement.children as HTMLCollectionOf<HTMLElement>;
    return items.length >= 2 ? items[1].offsetLeft - items[0].offsetLeft : 0;
  }

  private autoplay(): void {
    if (!this.loop() || this.hidden() || this.hovering || this.dragging() || document.hidden) return;
    if (!this.inView || this.reducedMotion) return;
    if (Date.now() < this.pausedUntil) return;
    this.slide(this.cardStep());
  }

  /** Trượt mượt một đoạn; sắp chạm mép của 3 bộ thì nhảy sang bộ bên cạnh trước (cùng vị trí thẻ) */
  private slide(delta: number): void {
    const el = this.track().nativeElement;
    if (this.loop()) {
      const set = this.setWidth();
      const max = el.scrollWidth - el.clientWidth;
      if (el.scrollLeft + delta > max - 2) this.jump(el.scrollLeft - set);
      else if (el.scrollLeft + delta < 2) this.jump(el.scrollLeft + set);
    }
    el.scrollBy({ left: delta, behavior: 'smooth' });
  }

  /** Đang ở bộ bản sao: nhảy về vị trí tương ứng ở bộ giữa */
  private recenter(): void {
    if (!this.loop() || this.dragging()) return;
    const el = this.track().nativeElement;
    const set = this.setWidth();
    if (!set) return;
    if (el.scrollLeft < set * 0.5) this.jump(el.scrollLeft + set);
    else if (el.scrollLeft >= set * 1.5) this.jump(el.scrollLeft - set);
  }

  /** Cuộn tức thì (không hiệu ứng) */
  private jump(left: number): void {
    const el = this.track().nativeElement;
    el.style.scrollBehavior = 'auto';
    el.scrollLeft = left;
    el.style.scrollBehavior = '';
  }

  /** Giữ chuột rồi kéo ngang (cảm ứng dùng cuộn sẵn có của trình duyệt) */
  protected dragStart(e: PointerEvent): void {
    this.pause(); // chạm / bấm vào hàng thẻ (cả vuốt cảm ứng): dừng tự trượt
    if (e.pointerType !== 'mouse' || e.button !== 0 || !this.canScroll()) return;
    const el = this.track().nativeElement;
    this.dragX = e.clientX;
    this.dragScroll = el.scrollLeft;
    this.moved = 0;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - this.dragX;
      this.moved = Math.max(this.moved, Math.abs(dx));
      if (this.moved > DRAG_THRESHOLD) this.dragging.set(true);
      el.scrollLeft = this.dragScroll - dx;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      // Bật lại snap để thẻ dừng ngay ngắn
      this.dragging.set(false);
      this.pause();
      this.onScroll();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  /** Vừa kéo xong thì không coi là bấm mở */
  protected onCardClick(e: MouseEvent, id: string): void {
    if (this.moved > DRAG_THRESHOLD) {
      e.preventDefault();
      this.moved = 0;
      return;
    }
    this.open.emit(id);
  }
}
