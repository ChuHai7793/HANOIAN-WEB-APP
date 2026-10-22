import { TestBed } from '@angular/core/testing';
import { THEME_KEY, ThemeService } from './theme.service';

describe('ThemeService (chế độ Sáng / Tối)', () => {
  beforeEach(() => {
    localStorage.removeItem(THEME_KEY);
    document.documentElement.classList.remove('dark');
  });

  it('mặc định Sáng; bật Tối thì gắn lớp dark lên <html> và nhớ lại', () => {
    const service = TestBed.inject(ThemeService);
    TestBed.tick();
    expect(service.isDark()).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    service.toggle();
    TestBed.tick();
    expect(service.isDark()).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
  });

  it('mở lại trình duyệt thì giữ chế độ đã chọn', () => {
    localStorage.setItem(THEME_KEY, 'dark');
    const service = TestBed.inject(ThemeService);
    TestBed.tick();
    expect(service.isDark()).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
