import {
  inject,
  Injectable,
  makeStateKey,
  PLATFORM_ID,
  signal,
  TransferState,
} from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { CatalogService } from './catalog.service';
import { SpotService } from './spot.service';

/** Trang có ảnh nền admin đổi được; trang chủ dùng chung ảnh với Khám phá quán */
export type BannerPage = 'explore' | 'spots';

interface BannerState {
  /** Ảnh admin chọn; null = ảnh mặc định của trang */
  custom: ReturnType<typeof signal<string | null>>;
  /** Đã biết ảnh nào (có ảnh admin hay không) */
  ready: ReturnType<typeof signal<boolean>>;
  /** Đang gọi API (gộp các trang cùng hỏi một lúc) */
  pending: Promise<void> | null;
}

/**
 * Ảnh nền banner của Khám phá quán (+ trang chủ) và Tìm chỗ chơi, nhớ trong bộ nhớ suốt phiên: chuyển qua
 * lại giữa các trang không gọi lại API và không nháy từ ảnh mặc định sang ảnh admin. Bản SSR: server lấy
 * ảnh rồi gửi kèm trong HTML (TransferState), trình duyệt đọc ngay lúc khởi động nên lần mở đầu cũng
 * hiện đúng ảnh từ khung hình đầu tiên.
 */
@Injectable({ providedIn: 'root' })
export class BannerService {
  private readonly catalog = inject(CatalogService);
  private readonly spots = inject(SpotService);
  private readonly transfer = inject(TransferState);
  private readonly isServer = isPlatformServer(inject(PLATFORM_ID));

  private readonly pages: Record<BannerPage, BannerState> = {
    explore: this.init('explore'),
    spots: this.init('spots'),
  };

  custom(page: BannerPage) {
    return this.pages[page].custom.asReadonly();
  }

  ready(page: BannerPage) {
    return this.pages[page].ready.asReadonly();
  }

  /** Lấy ảnh lần đầu; đã biết rồi thì không gọi lại */
  load(page: BannerPage): Promise<void> {
    const s = this.pages[page];
    if (s.ready()) return Promise.resolve();
    if (s.pending) return s.pending;
    s.pending = this.api(page)
      .get()
      .then((b) => {
        s.custom.set(b.imageUrl);
        if (this.isServer) this.transfer.set(key(page), b.imageUrl);
      })
      .catch(() => undefined)
      .finally(() => {
        s.ready.set(true);
        s.pending = null;
      });
    return s.pending;
  }

  /** Admin: đổi ảnh (url) hoặc về ảnh mặc định (null) */
  async set(page: BannerPage, imageUrl: string | null): Promise<void> {
    const res = await this.api(page).set(imageUrl);
    this.pages[page].custom.set(res.imageUrl);
    this.pages[page].ready.set(true);
  }

  /** Trình duyệt: lấy giá trị server đã gửi kèm (nếu có) để khung hình đầu đã đúng ảnh */
  private init(page: BannerPage): BannerState {
    const k = key(page);
    const known = !this.isServer && this.transfer.hasKey(k);
    const state: BannerState = {
      custom: signal<string | null>(known ? this.transfer.get(k, null) : null),
      ready: signal(known),
      pending: null,
    };
    if (known) this.transfer.remove(k);
    return state;
  }

  private api(page: BannerPage) {
    return page === 'explore'
      ? {
          get: () => this.catalog.banner(),
          set: (url: string | null) => this.catalog.setBanner(url),
        }
      : { get: () => this.spots.banner(), set: (url: string | null) => this.spots.setBanner(url) };
  }
}

function key(page: BannerPage) {
  return makeStateKey<string | null>(`banner:${page}`);
}
