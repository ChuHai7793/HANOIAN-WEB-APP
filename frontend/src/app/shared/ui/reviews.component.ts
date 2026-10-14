import { HttpErrorResponse } from '@angular/common/http';
import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { errorMessage } from '../../core/api/api';
import { AuthService } from '../../core/auth/auth.service';
import { LoginGate } from '../../core/auth/login-gate.service';
import {
  Companion,
  COMPANIONS,
  Review,
  REVIEW_SORTS,
  ReviewSort,
  ReviewSummary,
  ReviewTarget,
  ratingText,
  timeAgo,
} from '../../core/models/review.model';
import { ReviewService } from '../../core/services/review.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from './icon.component';

const PAGE_SIZE = 5;

/**
 * Mục "Đánh giá" trong popup chi tiết quán / chỗ chơi: điểm trung bình + biểu đồ sao, đánh giá của mình
 * (viết / sửa / xoá), danh sách đánh giá của người khác (sắp xếp, xem thêm) và nút "Hữu ích".
 * Khách xem được; bấm viết / Hữu ích thì hiện popup đăng nhập.
 */
@Component({
  selector: 'app-reviews',
  imports: [IconComponent],
  template: `
    <section class="flex flex-col gap-4 border-t border-slate-100 pt-4">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-base font-bold text-slate-900">Đánh giá</h3>
        @if (summary(); as s) {
          @if (s.count) {
            <span class="text-xs text-slate-500">{{ s.count }} đánh giá</span>
          }
        }
      </div>

      @if (summary(); as s) {
        @if (s.count) {
          <div class="flex items-center gap-5 rounded-xl bg-brand-50/60 p-3">
            <div class="flex w-20 shrink-0 flex-col items-center">
              <span class="text-3xl font-extrabold text-slate-900">{{ avgText(s) }}</span>
              <span class="text-sm tracking-[1px] text-[#E29A2D]" aria-hidden="true">{{ starRow(s.average ?? 0) }}</span>
            </div>
            <div class="flex min-w-0 flex-1 flex-col gap-1">
              @for (n of [5, 4, 3, 2, 1]; track n) {
                <div class="flex items-center gap-2 text-[11px] text-slate-500">
                  <span class="w-5 text-right">{{ n }}★</span>
                  <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-white">
                    <div class="h-full rounded-full bg-[#E29A2D]" [style.width.%]="(100 * s.histogram[n - 1]) / s.count"></div>
                  </div>
                  <span class="w-5">{{ s.histogram[n - 1] }}</span>
                </div>
              }
            </div>
          </div>
        }
      }

      <!-- Đánh giá của mình: xem / sửa; chưa có thì mời chấm sao -->
      @if (editing()) {
        <div class="flex flex-col gap-3 rounded-xl border border-brand-200 p-3">
          <div class="flex items-center gap-1" role="radiogroup" aria-label="Số sao">
            @for (n of [1, 2, 3, 4, 5]; track n) {
              <button type="button" role="radio" [attr.aria-checked]="draftRating() === n" [attr.aria-label]="n + ' sao'" class="text-2xl leading-none transition" [class]="n <= draftRating() ? 'text-[#E29A2D]' : 'text-[#D9D3EA] hover:text-[#E29A2D]/60'" (click)="draftRating.set(n)">★</button>
            }
            <span class="ml-2 text-xs text-slate-500">{{ ratingWord(draftRating()) }}</span>
          </div>
          <textarea
            class="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            maxlength="1000"
            placeholder="Không gian, đồ uống, phục vụ, có hợp hẹn hò không…"
            [value]="draftBody()"
            (input)="draftBody.set($any($event.target).value)"
          ></textarea>
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="mr-1 text-xs text-slate-500">Đi cùng:</span>
            @for (c of companions; track c.value) {
              <button type="button" class="rounded-full border px-2.5 py-1 text-xs transition" [class]="draftCompanion() === c.value ? 'border-brand-500 bg-brand-50 font-semibold text-brand-700' : 'border-slate-200 text-slate-600 hover:border-brand-200'" (click)="draftCompanion.set(draftCompanion() === c.value ? null : c.value)">{{ c.label }}</button>
            }
          </div>
          @if (formError()) {
            <p class="text-xs text-rose-600">{{ formError() }}</p>
          }
          <div class="flex items-center justify-between gap-2">
            <span class="text-[11px] text-slate-400">{{ draftBody().trim().length }}/1000</span>
            <div class="flex gap-2">
              <button type="button" class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50" (click)="editing.set(false)">Huỷ</button>
              <button type="button" class="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50" [disabled]="busy()" (click)="submit()">{{ mine() ? 'Lưu' : 'Đăng' }}</button>
            </div>
          </div>
        </div>
      } @else if (mine(); as m) {
        <div class="rounded-xl border border-brand-200 bg-brand-50/40 p-3">
          <div class="mb-1 flex items-center justify-between gap-2">
            <span class="text-xs font-semibold text-brand-700">Đánh giá của bạn</span>
            <div class="flex gap-1">
              <button type="button" class="rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-white" (click)="startEdit()">Sửa</button>
              <button type="button" class="rounded-md px-2 py-1 text-xs text-rose-600 hover:bg-white disabled:opacity-50" [class.font-semibold]="confirmDelete()" [disabled]="busy()" (click)="remove()">{{ confirmDelete() ? 'Xoá thật?' : 'Xoá' }}</button>
            </div>
          </div>
          <p class="text-sm tracking-[1px] text-[#E29A2D]" aria-hidden="true">{{ starRow(m.rating) }}</p>
          <p class="mt-1 whitespace-pre-line text-sm text-slate-700">{{ m.body }}</p>
          <p class="mt-1.5 text-[11px] text-slate-400">{{ ago(m.updatedAt) }}{{ m.companion ? ' · Đi cùng ' + companionLabel(m.companion) : '' }} · {{ m.helpfulCount }} người thấy hữu ích</p>
        </div>
      } @else {
        <div class="flex items-center justify-between gap-3 rounded-xl border border-dashed border-brand-200 px-3 py-2.5">
          <span class="text-sm text-slate-600">{{ summary()?.count ? 'Bạn đã đến đây chưa?' : 'Chưa có đánh giá. Hãy là người đầu tiên!' }}</span>
          <div class="flex shrink-0 items-center gap-0.5">
            @for (n of [1, 2, 3, 4, 5]; track n) {
              <button type="button" class="text-2xl leading-none text-[#D9D3EA] transition hover:text-[#E29A2D]" [attr.aria-label]="'Chấm ' + n + ' sao'" (click)="startNew(n)">★</button>
            }
          </div>
        </div>
      }

      @if (total() > 0) {
        <div class="flex flex-wrap gap-1.5" role="group" aria-label="Sắp xếp đánh giá">
          @for (o of sorts; track o.value) {
            <button type="button" class="rounded-full px-3 py-1 text-xs transition" [class]="sort() === o.value ? 'bg-brand-100 font-semibold text-brand-800' : 'text-slate-500 hover:bg-slate-50'" (click)="changeSort(o.value)">{{ o.label }}</button>
          }
        </div>
        <ul class="flex flex-col divide-y divide-slate-100">
          @for (r of items(); track r.id) {
            <li class="flex gap-3 py-3">
              @if (r.author.avatarUrl) {
                <img [src]="r.author.avatarUrl" alt="" class="h-9 w-9 shrink-0 rounded-full object-cover" />
              } @else {
                <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">{{ initial(r.author.displayName) }}</span>
              }
              <div class="min-w-0 flex-1">
                <p class="flex flex-wrap items-center gap-x-2 text-sm">
                  <span class="font-semibold text-slate-900">{{ r.author.displayName }}</span>
                  <span class="tracking-[1px] text-[#E29A2D]" [attr.aria-label]="r.rating + ' sao'">{{ starRow(r.rating) }}</span>
                </p>
                <p class="text-[11px] text-slate-400">{{ ago(r.createdAt) }}{{ r.companion ? ' · Đi cùng ' + companionLabel(r.companion) : '' }}</p>
                <p class="mt-1 whitespace-pre-line text-sm text-slate-700">{{ r.body }}</p>
                <button
                  type="button"
                  class="mt-1.5 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition"
                  [class]="r.helpedByMe ? 'border-brand-300 bg-brand-50 font-semibold text-brand-700' : 'border-slate-200 text-slate-500 hover:border-brand-200 hover:text-brand-700'"
                  [attr.aria-pressed]="r.helpedByMe"
                  (click)="toggleHelpful(r)"
                >
                  <app-icon name="thumbUp" [size]="13" />Hữu ích{{ r.helpfulCount ? ' (' + r.helpfulCount + ')' : '' }}
                </button>
              </div>
            </li>
          }
        </ul>
        @if (items().length < total()) {
          <button type="button" class="self-center rounded-lg px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50" [disabled]="loading()" (click)="loadMore()">
            Xem thêm đánh giá ({{ total() - items().length }})
          </button>
        }
      }
    </section>
  `,
})
export class ReviewsComponent {
  private readonly api = inject(ReviewService);
  private readonly gate = inject(LoginGate);
  private readonly toast = inject(ToastService);
  private readonly loggedIn = inject(AuthService).isLoggedIn;

  readonly target = input.required<ReviewTarget>();
  readonly targetId = input.required<string>();
  /** Điểm trung bình / số đánh giá đổi (mình vừa viết, sửa, xoá): cập nhật thẻ ngoài danh sách */
  readonly summaryChange = output<{ ratingAvg: number | null; ratingCount: number }>();

  protected readonly companions = COMPANIONS;
  protected readonly sorts = REVIEW_SORTS;

  protected readonly summary = signal<ReviewSummary | null>(null);
  protected readonly mine = signal<Review | null>(null);
  protected readonly items = signal<Review[]>([]);
  protected readonly total = signal(0);
  protected readonly sort = signal<ReviewSort>('helpful');
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);

  protected readonly editing = signal(false);
  protected readonly draftRating = signal(0);
  protected readonly draftBody = signal('');
  protected readonly draftCompanion = signal<Companion | null>(null);
  protected readonly formError = signal('');
  protected readonly confirmDelete = signal(false);
  private page = 0;

  protected readonly avgText = (s: ReviewSummary) => (s.average === null ? '–' : ratingText(s.average));

  constructor() {
    // Mở popup địa điểm khác, hoặc vừa đăng nhập: tải lại
    effect(() => {
      this.target();
      this.targetId();
      this.loggedIn();
      untracked(() => void this.reload());
    });
  }

  protected starRow(rating: number): string {
    const full = Math.round(rating);
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  }

  protected ratingWord(n: number): string {
    return ['Chạm để chấm sao', 'Tệ', 'Chưa ổn', 'Bình thường', 'Tốt', 'Tuyệt vời'][n];
  }

  protected companionLabel(c: Companion): string {
    return COMPANIONS.find((x) => x.value === c)?.label.toLowerCase() ?? '';
  }

  protected ago(iso: string): string {
    return timeAgo(iso);
  }

  protected initial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || '?';
  }

  protected startNew(rating: number): void {
    if (!this.gate.check('viết đánh giá', () => this.startNew(rating))) return;
    // Đăng nhập xong mới biết đã có đánh giá chưa: có rồi thì sửa
    const m = this.mine();
    this.draftRating.set(rating);
    this.draftBody.set(m?.body ?? '');
    this.draftCompanion.set(m?.companion ?? null);
    this.formError.set('');
    this.editing.set(true);
  }

  protected startEdit(): void {
    const m = this.mine();
    if (!m) return;
    this.draftRating.set(m.rating);
    this.draftBody.set(m.body);
    this.draftCompanion.set(m.companion);
    this.formError.set('');
    this.editing.set(true);
  }

  protected async submit(): Promise<void> {
    if (this.draftRating() < 1) return this.formError.set('Chọn số sao.');
    if (this.draftBody().trim().length < 10) return this.formError.set('Viết nhận xét ít nhất 10 ký tự.');
    this.busy.set(true);
    try {
      await this.api.save(this.target(), this.targetId(), {
        rating: this.draftRating(),
        body: this.draftBody().trim(),
        companion: this.draftCompanion(),
      });
      this.editing.set(false);
      this.toast.success(this.mine() ? 'Đã sửa đánh giá.' : 'Cảm ơn bạn đã đánh giá!');
      await this.reload(true);
    } catch (err) {
      this.formError.set(err instanceof HttpErrorResponse ? errorMessage(err) : 'Không lưu được đánh giá.');
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(): Promise<void> {
    // Bấm 2 lần mới xoá: lần đầu đổi nút thành "Xoá thật?"
    if (!this.confirmDelete()) {
      this.confirmDelete.set(true);
      setTimeout(() => this.confirmDelete.set(false), 4000);
      return;
    }
    this.confirmDelete.set(false);
    this.busy.set(true);
    try {
      await this.api.delete(this.target(), this.targetId());
      this.toast.success('Đã xoá đánh giá.');
      await this.reload(true);
    } finally {
      this.busy.set(false);
    }
  }

  protected async toggleHelpful(r: Review): Promise<void> {
    if (!this.gate.check('bấm Hữu ích')) return;
    const on = !r.helpedByMe;
    // Đổi ngay trên màn hình, sai thì trả lại
    this.patch(r.id, { helpedByMe: on, helpfulCount: r.helpfulCount + (on ? 1 : -1) });
    try {
      const res = await this.api.helpful(r.id, on);
      this.patch(r.id, res);
    } catch {
      this.patch(r.id, { helpedByMe: r.helpedByMe, helpfulCount: r.helpfulCount });
    }
  }

  protected async changeSort(sort: ReviewSort): Promise<void> {
    if (sort === this.sort()) return;
    this.sort.set(sort);
    await this.reload();
  }

  protected async loadMore(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.api.list(this.target(), this.targetId(), this.sort(), this.page + 1, PAGE_SIZE);
      this.page = res.page;
      this.items.update((list) => [...list, ...res.items.filter((r) => !list.some((x) => x.id === r.id))]);
      this.total.set(res.total);
    } finally {
      this.loading.set(false);
    }
  }

  private async reload(notify = false): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.api.list(this.target(), this.targetId(), this.sort(), 0, PAGE_SIZE);
      this.page = 0;
      this.summary.set(res.summary);
      this.mine.set(res.mine);
      this.items.set(res.items);
      this.total.set(res.total);
      if (notify) this.summaryChange.emit({ ratingAvg: res.summary.average, ratingCount: res.summary.count });
    } catch {
      // Lỗi mạng: errorInterceptor đã báo; mục đánh giá để trống
    } finally {
      this.loading.set(false);
    }
  }

  private patch(id: string, change: Partial<Review>): void {
    this.items.update((list) => list.map((r) => (r.id === id ? { ...r, ...change } : r)));
  }
}
