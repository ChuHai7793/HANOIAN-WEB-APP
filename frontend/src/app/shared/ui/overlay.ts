import { DOCUMENT, DestroyRef, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';

/**
 * Hai việc mọi lớp phủ (menu trượt, popup, bảng lọc) cần trên điện thoại:
 *
 * 1. Khoá cuộn trang phía sau: iOS vẫn cuộn body dù `overflow: hidden`, nên trên cảm ứng ghim body bằng
 *    `position: fixed` và trả lại vị trí cuộn khi mở khoá. Đếm lồng nhau (popup mở trong popup).
 * 2. Nút Back của điện thoại đóng lớp phủ thay vì thoát trang: khi mở, đẩy một mục vào history; Back → popstate
 *    → đóng lớp phủ. Đóng bằng ✕ / bấm nền / Esc thì tự lùi history để không để lại mục thừa (trừ khi đang
 *    điều hướng sang trang khác: lùi lúc đó sẽ huỷ điều hướng).
 */

interface Entry {
  token: string;
  onBack: () => void;
}

/** Lớp phủ đang mở, theo thứ tự mở (mục cuối ở trên cùng) */
const stack: Entry[] = [];
let locks = 0;
let savedScrollY = 0;
let listening = false;

const STATE_KEY = 'gfmOverlay';

function stateToken(): string | null {
  const s = typeof history !== 'undefined' ? history.state : null;
  return s && typeof s === 'object' && typeof s[STATE_KEY] === 'string' ? s[STATE_KEY] : null;
}

/** Back: đóng mọi lớp phủ mở sau mục history vừa quay về */
function onPopState(): void {
  const token = stateToken();
  const idx = token ? stack.findIndex((e) => e.token === token) : -1;
  const closing = stack.splice(idx + 1);
  for (const e of closing.reverse()) e.onBack();
}

function lock(doc: Document): void {
  if (locks++ > 0) return;
  const win = doc.defaultView;
  savedScrollY = win?.scrollY ?? 0;
  const body = doc.body;
  body.style.overflow = 'hidden';
  // Chỉ ghim trên cảm ứng: máy tính overflow hidden là đủ và không làm trang nhảy khi thanh cuộn biến mất
  // (matchMedia có thể thiếu trong môi trường test)
  if (win?.matchMedia?.('(hover: none)').matches) {
    body.style.position = 'fixed';
    body.style.top = `-${savedScrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
  }
}

function unlock(doc: Document): void {
  if (locks === 0 || --locks > 0) return;
  const body = doc.body;
  const pinned = body.style.position === 'fixed';
  body.style.overflow = '';
  body.style.position = '';
  body.style.top = '';
  body.style.left = '';
  body.style.right = '';
  body.style.width = '';
  if (pinned) doc.defaultView?.scrollTo(0, savedScrollY);
}

/** Một lớp phủ: gọi `open()` khi hiện, `close()` khi ẩn (bất kể lý do). */
export class OverlayHandle {
  private entry: Entry | null = null;

  constructor(
    private readonly doc: Document,
    private readonly onBack: () => void,
    private readonly router: Router | null = null,
  ) {}

  open(): void {
    if (this.entry) return;
    const win = this.doc.defaultView;
    if (!win) return;
    lock(this.doc);
    this.entry = { token: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, onBack: this.onBack };
    stack.push(this.entry);
    if (!listening) {
      listening = true;
      win.addEventListener('popstate', onPopState);
    }
    try {
      const top = stateToken();
      const state = { ...(history.state ?? {}), [STATE_KEY]: this.entry.token };
      // Mục trên cùng là của một lớp phủ vừa đóng (đóng A rồi mở B ngay, vd. popup chi tiết → "Vào plan"):
      // dùng lại mục đó thay vì chồng thêm
      if (top && !stack.some((e) => e.token === top)) history.replaceState(state, '');
      else history.pushState(state, '');
    } catch {
      // Trình duyệt chặn pushState (hiếm): vẫn khoá cuộn, chỉ không bắt được nút Back
    }
  }

  close(): void {
    const entry = this.entry;
    if (!entry) return;
    this.entry = null;
    unlock(this.doc);
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
    // Mục history của mình còn ở trên cùng (đóng bằng ✕, bấm nền, Esc): lùi lại để không dồn mục thừa.
    // Chờ một nhịp: nếu ngay sau đó có lớp phủ khác mở (dùng lại mục) hoặc router đang điều hướng thì thôi,
    // vì lùi lúc đó sẽ huỷ điều hướng. Không còn ở trên cùng (Back vừa đóng, đã sang trang khác): giữ nguyên.
    this.doc.defaultView?.setTimeout(() => {
      if (stateToken() === entry.token && !this.router?.getCurrentNavigation()) history.back();
    }, 0);
  }
}

/**
 * Dùng trong constructor của component lớp phủ: khoá cuộn + bắt nút Back suốt vòng đời component.
 * `onBack` thường là emit sự kiện đóng, trang cha sẽ huỷ component.
 */
export function useOverlay(onBack: () => void): void {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
  const handle = new OverlayHandle(inject(DOCUMENT), onBack, inject(Router, { optional: true }));
  handle.open();
  inject(DestroyRef).onDestroy(() => handle.close());
}
