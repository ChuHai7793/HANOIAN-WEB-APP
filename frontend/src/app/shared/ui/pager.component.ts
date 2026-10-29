import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import {
  ActivatedRoute,
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  Router,
} from '@angular/router';
import { IconComponent } from './icon.component';

/** Số mục mỗi trang của mọi danh sách */
export const PAGE_SIZE = 20;

/** Tham số số trang trên đường dẫn: /explore?trang=3 */
const PARAM = 'trang';

/**
 * Số trang của một danh sách, giữ trên đường dẫn (?trang=3): tải lại, gửi link hay quay lại từ trang quán đều
 * mở đúng trang. Ghi bằng replaceUrl như các bộ lọc, nên nút Back không đi lùi từng trang.
 * Gọi trong ngữ cảnh inject (khởi tạo field của component). `anchor`: id phần tử đầu danh sách, chuyển trang
 * thì cuộn tới đó.
 */
export function listPager(anchor: string) {
  const route = inject(ActivatedRoute);
  const router = inject(Router);
  const doc = inject(DOCUMENT);
  const read = () => {
    const n = Number(route.snapshot.queryParamMap.get(PARAM));
    return Number.isInteger(n) && n > 1 ? n : 1;
  };
  const page = signal(read());
  /**
   * Ghi ?trang= lên đường dẫn. Trang vừa ghi bộ lọc (?khuvuc=, ?loai=…) ngay trước đó thì lần đó còn đang chạy:
   * ghi luôn sẽ gộp với đường dẫn cũ và huỷ lần kia (mất bộ lọc), nên chờ lần đang chạy xong rồi mới ghi.
   */
  const write = (n: number) => {
    const go = () =>
      void router.navigate([], {
        queryParams: { [PARAM]: n > 1 ? n : null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    if (!router.currentNavigation()) return go();
    const sub = router.events.subscribe((e) => {
      if (
        e instanceof NavigationEnd ||
        e instanceof NavigationCancel ||
        e instanceof NavigationError
      ) {
        sub.unsubscribe();
        go();
      }
    });
  };

  return {
    /** Trang hiện tại, đếm từ 1 */
    page: page.asReadonly(),
    size: PAGE_SIZE,
    /** Chỉ số bắt đầu (đếm từ 0) của trang hiện tại, dùng cắt mảng hoặc gửi API (page - 1) */
    offset: computed(() => (page() - 1) * PAGE_SIZE),
    /** Cắt danh sách đã tải sẵn theo trang hiện tại */
    slice<T>(list: readonly T[]): T[] {
      return list.slice((page() - 1) * PAGE_SIZE, page() * PAGE_SIZE);
    },
    /** Đọc lại từ đường dẫn (khi trang tự khởi tạo lại) */
    sync(): void {
      page.set(read());
    },
    /** Người dùng bấm sang trang n: ghi lên đường dẫn, cuộn lên đầu danh sách */
    go(n: number): void {
      if (n === page()) return;
      page.set(n);
      write(n);
      doc.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    /** Bộ lọc / từ khoá / tab đổi: về trang 1 */
    reset(): void {
      if (page() === 1) return;
      page.set(1);
      write(1);
    },
    /** Danh sách ngắn lại (xoá mục, dữ liệu tải lại) làm trang hiện tại vượt quá số trang: lùi về trang cuối */
    clamp(total: number): void {
      const last = Math.max(1, Math.ceil(total / PAGE_SIZE));
      if (page() > last) {
        page.set(last);
        write(last);
      }
    },
  };
}

export type ListPager = ReturnType<typeof listPager>;

/**
 * Thanh phân trang cuối danh sách: ‹ Trước 1 2 3 … 8 Sau ›. Điện thoại gọn lại: ‹ Trước · Trang 3/8 · Sau ›.
 * Không hiện khi chỉ có một trang.
 */
@Component({
  selector: 'app-pager',
  imports: [IconComponent],
  template: `
    @if (pages() > 1) {
      <nav class="flex flex-col items-center gap-2" aria-label="Phân trang">
        <div class="flex items-center gap-1.5">
          <button
            type="button"
            [class]="edgeClass"
            [disabled]="page() <= 1"
            (click)="pageChange.emit(page() - 1)"
            aria-label="Trang trước"
          >
            <span class="rotate-180"><app-icon name="arrowRight" [size]="15" [stroke]="2.4" /></span
            ><span class="max-sm:hidden">Trước</span>
          </button>
          <!-- Màn rộng: các số trang; điện thoại: "Trang 3/8" -->
          <span class="px-2 text-sm font-medium text-slate-600 sm:hidden"
            >Trang {{ page() }}/{{ pages() }}</span
          >
          @for (n of numbers(); track $index) {
            @if (n === null) {
              <span class="w-6 text-center text-slate-400 max-sm:hidden" aria-hidden="true">…</span>
            } @else {
              <button
                type="button"
                class="min-h-10 min-w-10 rounded-xl px-2 text-sm font-semibold transition max-sm:hidden"
                [class]="
                  n === page()
                    ? 'bg-brand-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50'
                "
                [attr.aria-current]="n === page() ? 'page' : null"
                [attr.aria-label]="'Trang ' + n"
                (click)="pageChange.emit(n)"
              >
                {{ n }}
              </button>
            }
          }
          <button
            type="button"
            [class]="edgeClass"
            [disabled]="page() >= pages()"
            (click)="pageChange.emit(page() + 1)"
            aria-label="Trang sau"
          >
            <span class="max-sm:hidden">Sau</span
            ><app-icon name="arrowRight" [size]="15" [stroke]="2.4" />
          </button>
        </div>
        <p class="text-xs text-slate-500">
          {{ from() }}–{{ to() }} trên {{ total() }} {{ unit() }}
        </p>
      </nav>
    }
  `,
})
export class PagerComponent {
  /** Trang hiện tại, đếm từ 1 */
  readonly page = input.required<number>();
  readonly total = input.required<number>();
  readonly size = input(PAGE_SIZE);
  /** Tên mục, vd. "quán", "chỗ chơi", "bài" */
  readonly unit = input('mục');
  readonly pageChange = output<number>();

  protected readonly edgeClass =
    'flex min-h-10 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 disabled:pointer-events-none disabled:opacity-40';

  protected readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.size())));
  protected readonly from = computed(() =>
    Math.min(this.total(), (this.page() - 1) * this.size() + 1),
  );
  protected readonly to = computed(() => Math.min(this.total(), this.page() * this.size()));

  /** Số trang để hiện: đầu, cuối, trang hiện tại ±1; null là dấu "…" */
  protected readonly numbers = computed(() => pageNumbers(this.page(), this.pages()));
}

/** 1 … 4 5 6 … 12; ít trang (≤ 7) thì hiện hết */
export function pageNumbers(page: number, pages: number): (number | null)[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  for (const n of sorted) {
    const prev = out[out.length - 1];
    if (typeof prev === 'number' && n - prev === 2) out.push(prev + 1);
    else if (typeof prev === 'number' && n - prev > 2) out.push(null);
    out.push(n);
  }
  return out;
}
