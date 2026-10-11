import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { STREAM_BASE } from '../api/api';
import { AuthService } from '../auth/auth.service';
import { ChatMessage, Match } from '../models/dating.model';

/** Sự kiện server đẩy xuống. `ready`: vừa nối (lại) xong, nơi nhận nên lấy bù những gì bị lỡ. */
export type RealtimeEvent =
  | { type: 'ready' }
  | { type: 'message'; data: { matchId: string; message: ChatMessage } }
  | { type: 'read'; data: { matchId: string; readAt: string } }
  | { type: 'match'; data: Match }
  | { type: 'unmatch'; data: { matchId: string } };

/** Server gửi nhịp tim 25 giây/lần; im lâu hơn thế này coi như kết nối đã chết. */
const SILENCE_MS = 60_000;
const MAX_BACKOFF_MS = 30_000;

/**
 * Tách các sự kiện SSE hoàn chỉnh khỏi phần đầu {@code buffer}; phần chưa đủ trả lại trong {@code rest}.
 * Dòng bắt đầu bằng ':' là chú thích (nhịp tim), bỏ qua.
 */
export function parseSse(buffer: string): { events: { type: string; data: string }[]; rest: string } {
  const blocks = buffer.split(/\r?\n\r?\n/);
  const rest = blocks.pop() ?? '';
  const events: { type: string; data: string }[] = [];
  for (const block of blocks) {
    let type = 'message';
    const data: string[] = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('event:')) type = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
    }
    if (data.length) events.push({ type, data: data.join('\n') });
  }
  return { events, rest };
}

/** Chờ tăng dần khi nối lại (1s, 2s, 4s… tối đa 30s), cộng ngẫu nhiên để nghìn người không nối lại cùng lúc. */
export function backoff(attempt: number): number {
  const base = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt);
  return base / 2 + Math.random() * (base / 2);
}

/**
 * Kết nối SSE tới server khi đã đăng nhập ("Tìm đối tượng": tin nhắn, đã xem, match mới, bỏ match).
 * Dùng fetch thay EventSource để gửi được Bearer token. Mất kết nối thì tự nối lại; token hết hạn thì
 * refresh rồi nối lại; đăng xuất thì đóng.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly auth = inject(AuthService);
  private readonly events$ = new Subject<RealtimeEvent>();
  private session: AbortController | null = null;

  /** Đang có kết nối sống: nơi nhận có thể hỏi server thưa hơn. */
  readonly connected = signal(false);
  readonly events: Observable<RealtimeEvent> = this.events$.asObservable();

  constructor() {
    effect(() => {
      const loggedIn = this.auth.isLoggedIn();
      untracked(() => (loggedIn ? this.start() : this.stop()));
    });
  }

  private start(): void {
    if (this.session || typeof fetch === 'undefined') return;
    const session = new AbortController();
    this.session = session;
    void this.run(session.signal);
  }

  private stop(): void {
    this.session?.abort();
    this.session = null;
    this.connected.set(false);
  }

  private async run(stop: AbortSignal): Promise<void> {
    let attempt = 0;
    while (!stop.aborted) {
      try {
        const status = await this.connectOnce(stop, () => (attempt = 0));
        if (status === 401 && !(await this.auth.refreshAccessToken())) return; // phiên đã hết
      } catch {
        // mất mạng, server restart, bị cắt vì im lặng…
      }
      this.connected.set(false);
      if (stop.aborted) return;
      await sleep(backoff(attempt++), stop);
    }
  }

  /** Một lần nối: đọc tới khi luồng đóng. Trả về mã HTTP nếu server từ chối. */
  private async connectOnce(stop: AbortSignal, onOpen: () => void): Promise<number | void> {
    const conn = new AbortController();
    const abort = () => conn.abort();
    stop.addEventListener('abort', abort);
    let lastSeen = Date.now();
    const watchdog = setInterval(() => {
      if (Date.now() - lastSeen > SILENCE_MS) conn.abort();
    }, SILENCE_MS / 4);
    try {
      const res = await fetch(`${STREAM_BASE}/dating/stream`, {
        headers: { Accept: 'text/event-stream', Authorization: `Bearer ${this.auth.token() ?? ''}` },
        cache: 'no-store',
        signal: conn.signal,
      });
      if (!res.ok || !res.body) return res.status;
      onOpen();
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return;
        lastSeen = Date.now();
        const parsed = parseSse(buffer + value);
        buffer = parsed.rest;
        for (const e of parsed.events) this.dispatch(e.type, e.data);
      }
    } finally {
      clearInterval(watchdog);
      stop.removeEventListener('abort', abort);
    }
  }

  private dispatch(type: string, data: string): void {
    if (type === 'ready') {
      this.connected.set(true);
      this.events$.next({ type: 'ready' });
      return;
    }
    if (type !== 'message' && type !== 'read' && type !== 'match' && type !== 'unmatch') return;
    try {
      this.events$.next({ type, data: JSON.parse(data) } as RealtimeEvent);
    } catch {
      // sự kiện hỏng: bỏ qua, lần lấy bù sau sẽ đúng lại
    }
  }
}

function sleep(ms: number, stop: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(done, ms);
    stop.addEventListener('abort', done, { once: true });
    function done() {
      clearTimeout(t);
      stop.removeEventListener('abort', done);
      resolve();
    }
  });
}
