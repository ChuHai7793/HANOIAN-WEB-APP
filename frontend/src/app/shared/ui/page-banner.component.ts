import { Component, inject, input, output, signal } from '@angular/core';
import { BannerPage, BannerService } from '../../core/services/banner.service';
import { ToastService } from '../../core/services/toast.service';
import { UploadService } from '../../core/services/upload.service';

/** Ảnh nền mặc định: Hồ Gươm đêm, Radek Kucharski, CC BY 2.0 (Wikimedia Commons) */
export const DEFAULT_BANNER = '/banner/ho-guom-dem.webp';
/** Bản 900px cho điện thoại + bản gốc 1920px; trình duyệt chọn theo bề rộng banner */
export const DEFAULT_BANNER_SRCSET = '/banner/ho-guom-dem-900.webp 900w, /banner/ho-guom-dem.webp 1920w';
/** Ghi công bắt buộc khi dùng ảnh mặc định */
export const DEFAULT_BANNER_CREDIT = {
  text: 'Ảnh: Radek Kucharski · CC BY 2.0 (đã thu nhỏ, phủ màu)',
  href: 'https://commons.wikimedia.org/wiki/File:Hoan_Kiem_Lake_at_night.jpg',
};

/**
 * Banner đầu trang (Khám phá quán, Tìm chỗ chơi, My place): ảnh nền phủ tím, dòng nhỏ, tiêu đề lớn, câu giới
 * thiệu và bộ lọc (nội dung chính). Các khe: [bannerLeft] / [bannerRight] (hàng nút trên cùng), [bannerAside]
 * (trang trí bên phải). Admin đổi được ảnh nền khi `editable` (trang cha lo tải ảnh và lưu).
 * Điện thoại: gọn lại (bỏ dòng nhỏ và câu giới thiệu, tiêu đề nhỏ hơn) để danh sách lên gần màn hình đầu.
 */
@Component({
  selector: 'app-page-banner',
  template: `
    <section class="relative isolate overflow-hidden rounded-[22px] bg-[#3b2a7a] text-white shadow-sm">
      @if (image(); as src) {
        <!-- Ảnh đầu trang (LCP): ưu tiên tải cao, không lazy -->
        <img
          [src]="src"
          [attr.srcset]="imageSrcset()"
          [attr.sizes]="imageSrcset() ? '(min-width: 64rem) calc(100vw - 16rem), 100vw' : null"
          alt=""
          fetchpriority="high"
          decoding="async"
          class="absolute inset-0 -z-10 h-full w-full object-cover"
          [style.object-position]="imagePosition()"
        />
      }
      <!-- Tông tím: đậm bên trái (chỗ có chữ), nhạt dần sang phải; tối nhẹ ở trên / dưới -->
      <div class="absolute inset-0 -z-10 bg-gradient-to-r from-[#2d1f66]/90 via-[#4b33b0]/50 to-[#6d4fd6]/10"></div>
      <div class="absolute inset-0 -z-10 bg-gradient-to-t from-[#24184f]/75 via-transparent to-[#24184f]/35"></div>
      <ng-content select="[bannerAside]" />

      <div class="flex flex-col gap-3 p-3.5 pb-3 sm:gap-5 sm:p-6 sm:pb-9 lg:p-7 lg:pb-9">
        <div class="flex items-center gap-2">
          <ng-content select="[bannerLeft]" />
          <div class="ml-auto flex items-center gap-2">
            <ng-content select="[bannerRight]" />
          </div>
        </div>

        <div class="max-w-xl">
          <p class="hidden items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-white/85 sm:flex">
            <span class="h-px w-7 bg-white/60"></span>{{ kicker() }}
          </p>
          <h1 class="text-[26px] font-extrabold leading-tight tracking-tight sm:mt-2 sm:text-[40px]">{{ heading() }}</h1>
          <p class="mt-1 hidden text-[15px] text-white/85 sm:block">{{ tagline() }}</p>
        </div>

        <ng-content />
      </div>

      @if (credit() || editable()) {
        <!-- Ghi công ảnh / admin đổi ảnh nền -->
        <div class="flex items-center justify-end gap-3 px-4 pb-2 text-xs text-white/55 sm:absolute sm:bottom-2 sm:right-3 sm:px-0 sm:pb-0">
          @if (credit(); as c) {
            <a [href]="c.href" target="_blank" rel="noopener" class="py-1 hover:text-white">{{ c.text }}</a>
          }
          @if (editable()) {
            <div class="relative">
              <button type="button" class="min-h-9 rounded-full bg-black/30 px-3 text-xs font-medium text-white/90 backdrop-blur hover:bg-black/45 disabled:opacity-60" [disabled]="busy()" (click)="menuOpen.set(!menuOpen())">
                {{ busy() ? 'Đang tải ảnh…' : 'Đổi ảnh nền' }}
              </button>
              @if (menuOpen()) {
                <div class="absolute bottom-full right-0 z-30 mb-1 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm text-slate-700 shadow-lg">
                  <button type="button" class="block min-h-11 w-full px-3 text-left hover:bg-slate-50" (click)="menuOpen.set(false); file.click()">Tải ảnh lên…</button>
                  @if (custom()) {
                    <button type="button" class="block min-h-11 w-full px-3 text-left hover:bg-slate-50" (click)="menuOpen.set(false); reset.emit()">Dùng ảnh mặc định</button>
                  }
                </div>
              }
              <input #file type="file" accept="image/*" class="hidden" (change)="onFile($event)" />
            </div>
          }
        </div>
      }
    </section>
  `,
})
export class PageBannerComponent {
  /** Ảnh nền; null = chỉ nền tím */
  readonly image = input<string | null>(null);
  /** Các bản kích thước của ảnh nền (srcset); null = chỉ một ảnh */
  readonly imageSrcset = input<string | null>(null);
  readonly imagePosition = input('center');
  readonly kicker = input.required<string>();
  readonly heading = input.required<string>();
  readonly tagline = input.required<string>();
  readonly credit = input<{ text: string; href: string } | null>(null);
  /** Admin: hiện nút "Đổi ảnh nền" */
  readonly editable = input(false);
  /** Đang dùng ảnh admin tải lên (hiện "Dùng ảnh mặc định") */
  readonly custom = input(false);
  readonly busy = input(false);
  readonly upload = output<File>();
  readonly reset = output<void>();

  protected readonly menuOpen = signal(false);

  protected onFile(event: Event): void {
    const el = event.target as HTMLInputElement;
    const file = el.files?.[0];
    el.value = '';
    if (file) this.upload.emit(file);
  }
}

/**
 * Ảnh nền banner admin đổi được, lưu ở backend (app_settings): `custom` null = dùng ảnh mặc định của trang.
 * Giá trị nhớ trong BannerService (chung cho mọi trang, suốt phiên, server gửi kèm cho bản SSR); chưa biết
 * ảnh nào (`ready` false) thì trang chỉ hiện nền tím, không hiện tạm ảnh mặc định rồi đổi (nháy).
 * Gọi trong ngữ cảnh inject (khởi tạo field của component).
 */
export function editableBanner(page: BannerPage) {
  const banners = inject(BannerService);
  const uploads = inject(UploadService);
  const toast = inject(ToastService);
  const name = page === 'explore' ? 'banner kham pha quan' : 'banner tim cho choi';
  const busy = signal(false);

  return {
    custom: banners.custom(page),
    ready: banners.ready(page),
    busy: busy.asReadonly(),
    load(): void {
      void banners.load(page);
    },
    async upload(file: File): Promise<void> {
      busy.set(true);
      try {
        const up = await uploads.uploadFile(file, 1920, undefined, { purpose: 'banner', name });
        await banners.set(page, up.url);
        toast.success('Đã đổi ảnh nền.');
      } catch {
        // Lỗi HTTP đã được báo bằng toast
      } finally {
        busy.set(false);
      }
    },
    async reset(): Promise<void> {
      await banners.set(page, null);
      toast.success('Đã dùng lại ảnh nền mặc định.');
    },
  };
}
