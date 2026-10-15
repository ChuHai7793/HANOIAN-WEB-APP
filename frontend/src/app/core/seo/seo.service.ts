import { DOCUMENT } from '@angular/common';
import { inject, Injectable, RESPONSE_INIT } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export interface SeoData {
  /** Tiêu đề trang (chưa có "· HANOIVIBE" thì tự thêm) */
  title: string;
  description: string;
  /** Ảnh khi chia sẻ link (Zalo, Facebook) */
  image?: string | null;
  /** Đường dẫn trang, vd. /quan/cafe-cuoi-ngo (link canonical + og:url) */
  path: string;
  /** Dữ liệu có cấu trúc schema.org (JSON-LD) */
  jsonLd?: object | null;
  /** article cho bài viết, website cho trang khác */
  type?: 'website' | 'article';
}

const SITE = 'HANOIVIBE';

/**
 * Thẻ SEO cho từng trang công khai: title, description, Open Graph (ảnh khi chia sẻ link), link canonical và
 * JSON-LD. Chạy được cả khi render trên server (bản SSR), nên Google / Zalo đọc được ngay trong HTML.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);
  /** Chỉ có khi render trên server: đặt mã HTTP của trang */
  private readonly response = inject(RESPONSE_INIT, { optional: true });

  set(data: SeoData): void {
    const title = data.title.includes(SITE) ? data.title : `${data.title} · ${SITE}`;
    const description = data.description.replace(/\s+/g, ' ').trim().slice(0, 160);
    const url = this.absolute(data.path);
    this.title.setTitle(title);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: data.type ?? 'website' });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:site_name', content: SITE });
    this.meta.updateTag({ property: 'og:locale', content: 'vi_VN' });
    this.meta.updateTag({ name: 'twitter:card', content: data.image ? 'summary_large_image' : 'summary' });
    if (data.image) {
      this.meta.updateTag({ property: 'og:image', content: this.absolute(data.image) });
    } else {
      this.meta.removeTag("property='og:image'");
    }
    this.setCanonical(url);
    this.setJsonLd(data.jsonLd ?? null);
  }

  /**
   * Trang không tồn tại: trả HTTP 404 (bản SSR) và noindex, để Google không coi là trang trống bị trùng
   * ("soft 404").
   */
  notFound(title: string, path: string): void {
    this.set({ title, description: 'Trang không tồn tại.', path });
    this.meta.updateTag({ name: 'robots', content: 'noindex' });
    if (this.response) this.response.status = 404;
  }

  /** Rời trang: bỏ JSON-LD, canonical và noindex riêng của trang đó */
  clear(): void {
    this.setJsonLd(null);
    this.meta.removeTag("name='robots'");
    this.doc.head.querySelector('link[rel="canonical"]')?.remove();
  }

  /** "/quan/x" → "https://<tên miền đang mở>/quan/x"; URL đầy đủ giữ nguyên */
  absolute(path: string): string {
    if (/^https?:\/\//.test(path)) return path;
    const origin = this.doc.location?.origin && this.doc.location.origin !== 'null' ? this.doc.location.origin : '';
    return origin + (path.startsWith('/') ? path : '/' + path);
  }

  private setCanonical(url: string): void {
    let link = this.doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  private setJsonLd(data: object | null): void {
    this.doc.head.querySelector('script[data-seo="jsonld"]')?.remove();
    if (!data) return;
    const script = this.doc.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    script.setAttribute('data-seo', 'jsonld');
    // Chặn "</script>" trong dữ liệu (tên quán, mô tả do admin nhập) phá vỡ thẻ script
    script.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
    this.doc.head.appendChild(script);
  }
}
