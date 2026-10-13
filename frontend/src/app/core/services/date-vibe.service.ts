import { HttpClient, HttpContext } from '@angular/common/http';
import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from '../api/api';
import { SILENT_ERRORS } from '../api/http-context';
import { AuthService } from '../auth/auth.service';
import { Vibe } from '../models/vibe.model';

const LOCAL_KEY = 'gfm.dateVibe';

/**
 * Gu hẹn hò (kết quả quiz). Khách: lưu trên máy; đã đăng nhập: lưu vào tài khoản (khách làm quiz rồi mới
 * đăng ký thì kết quả được chuyển lên tài khoản). Dùng làm kiểu hẹn mặc định cho Autoplan.
 */
@Injectable({ providedIn: 'root' })
export class DateVibeService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  readonly vibe = signal<Vibe | null>(readLocal());

  constructor() {
    effect(() => {
      const loggedIn = this.auth.isLoggedIn();
      untracked(() => {
        if (loggedIn) void this.sync();
      });
    });
  }

  async save(vibe: Vibe): Promise<void> {
    this.vibe.set(vibe);
    writeLocal(vibe);
    if (this.auth.isLoggedIn()) await this.put(vibe).catch(() => undefined);
  }

  /** Đăng nhập: có kết quả trên máy mà tài khoản chưa có thì đẩy lên; không thì lấy từ tài khoản. */
  private async sync(): Promise<void> {
    try {
      const remote = (await firstValueFrom(this.http.get<{ vibe: Vibe | null }>(`${API_BASE}/me/vibe`, silent()))).vibe;
      const local = readLocal();
      if (!remote && local) await this.put(local);
      else if (remote) {
        this.vibe.set(remote);
        writeLocal(remote);
      }
    } catch {
      // không có cũng không sao
    }
  }

  private put(vibe: Vibe): Promise<void> {
    return firstValueFrom(this.http.put<void>(`${API_BASE}/me/vibe`, { vibe }, silent()));
  }
}

function silent() {
  return { context: new HttpContext().set(SILENT_ERRORS, true) };
}

function readLocal(): Vibe | null {
  try {
    const v = localStorage.getItem(LOCAL_KEY);
    return v === 'chill' || v === 'active' || v === 'romantic' ? v : null;
  } catch {
    return null;
  }
}

function writeLocal(vibe: Vibe): void {
  try {
    localStorage.setItem(LOCAL_KEY, vibe);
  } catch {
    // trình duyệt chặn lưu trữ
  }
}
