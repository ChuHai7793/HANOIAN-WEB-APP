import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

/** Khoá localStorage; index.html đọc cùng khoá này trước khi Angular chạy để không nháy sáng → tối */
export const THEME_KEY = 'gfm.theme';
/** Màu thanh trạng thái điện thoại (meta theme-color) theo từng chế độ */
const THEME_COLOR: Record<Theme, string> = { light: '#6d4fd6', dark: '#0b0a12' };

/**
 * Chế độ Sáng / Tối: lớp `dark` trên <html> (styles.scss đổi bảng màu theo lớp này), nhớ theo trình duyệt.
 * Mặc định Sáng; không theo hệ điều hành, người dùng tự bật.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly theme = signal<Theme>(this.read());
  readonly isDark = () => this.theme() === 'dark';

  constructor() {
    effect(() => {
      const theme = this.theme();
      if (!this.isBrowser) return;
      this.doc.documentElement.classList.toggle('dark', theme === 'dark');
      this.doc
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', THEME_COLOR[theme]);
      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch {
        // Chế độ ẩn danh / chặn lưu trữ: chỉ không nhớ được lựa chọn
      }
    });
  }

  toggle(): void {
    this.theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  set(theme: Theme): void {
    this.theme.set(theme);
  }

  private read(): Theme {
    if (!this.isBrowser) return 'light';
    try {
      return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  }
}
