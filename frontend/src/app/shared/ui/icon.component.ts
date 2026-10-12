import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/** Nét vẽ (viewBox 24×24) của các icon trong thiết kế HANOIVIBE. */
const PATHS = {
  compass: '<circle cx="12" cy="12" r="10"/><polygon points="16.2 7.8 14.1 14.1 7.8 16.2 9.9 9.9 16.2 7.8"/>',
  gate: '<path d="M2 20h20"/><path d="M5 20V9l7-5 7 5v11"/><path d="M10 20v-6h4v6"/>',
  heart:
    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  cup: '<path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/><path d="M6 2v2M10 2v2M14 2v2"/>',
  cocktail: '<path d="M8 22h8M12 11v11M3 3h18l-9 8z"/>',
  utensils:
    '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>',
  couple:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8.5c1.2-1.4 3-.6 3 .9 0 1.6-3 3.6-3 3.6s-3-2-3-3.6c0-1.5 1.8-2.3 3-.9z"/>',
  users:
    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  navigate: '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  flag: '<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
} as const;

export type IconName = keyof typeof PATHS;

/**
 * Icon nét (stroke) dùng chung, màu theo `currentColor`. `filled`: tô đặc (tim, sao) thay vì viền.
 * Nội dung SVG là hằng trong file này, không lấy từ dữ liệu người dùng.
 */
@Component({
  selector: 'app-icon',
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      [attr.fill]="filled() ? 'currentColor' : 'none'"
      stroke="currentColor"
      [attr.stroke-width]="filled() ? 0 : stroke()"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      [innerHTML]="svg()"
    ></svg>
  `,
  host: { class: 'inline-flex shrink-0' },
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input(20);
  readonly stroke = input(2);
  readonly filled = input(false);

  private readonly sanitizer = inject(DomSanitizer);
  /** Hằng trong code nên đánh dấu an toàn: sanitizer mặc định bỏ mất thẻ SVG */
  protected readonly svg = computed<SafeHtml>(() => this.sanitizer.bypassSecurityTrustHtml(PATHS[this.name()]));
}
