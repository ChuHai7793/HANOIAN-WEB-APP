import { HttpClient, HttpContext } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from '../api/api';
import { SILENT_ERRORS, SKIP_AUTH } from '../api/http-context';
import { DataBootstrapService } from '../services/data-bootstrap.service';

/** ADMIN: thêm/sửa/xoá được. GUEST: chỉ xem dữ liệu của admin. */
export type Role = 'ADMIN' | 'GUEST';

export interface AuthUser {
  id: string;
  email: string;
  username: string | null;
  displayName: string;
  role: Role;
  /** Ảnh đại diện trong hồ sơ (URL công khai), null nếu chưa có. */
  avatarUrl: string | null;
}

interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  user: AuthUser;
  /** Tài khoản vừa được tạo trong request này (đăng ký, lần đầu đăng nhập Google / Facebook) */
  newUser: boolean;
}

/** Request tới /auth/login|register|refresh|logout: không gắn Bearer, tự xử lý lỗi. */
const PUBLIC = () => new HttpContext().set(SKIP_AUTH, true).set(SILENT_ERRORS, true);

/** Khoá chung giữa các tab của cùng origin (Web Locks API); trình duyệt / server không có thì chạy luôn. */
function withCrossTabLock<T>(work: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  return locks ? (locks.request('gfm.auth.refresh', () => work()) as Promise<T>) : work();
}

/**
 * Phiên đăng nhập. Access token chỉ giữ trong bộ nhớ (không localStorage, để XSS khó lấy);
 * refresh token nằm trong cookie httpOnly do server đặt, JS không đọc được.
 * F5 trang thì gọi /auth/refresh để lấy lại access token.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly bootstrap = inject(DataBootstrapService);

  private readonly state = signal<AuthUser | null>(null);
  readonly user = this.state.asReadonly();
  readonly isLoggedIn = computed(() => this.state() !== null);
  /**
   * Chỉ admin mới thấy nút Thêm/Sửa/Xoá. Đây chỉ là giao diện: server vẫn chặn mọi request ghi
   * của guest (403) nên có sửa code frontend cũng không ghi được.
   */
  readonly canEdit = computed(() => this.state()?.role === 'ADMIN');

  private accessToken: string | null = null;
  /** Nhiều request cùng gặp 401 thì chỉ refresh một lần */
  private refreshing: Promise<string | null> | null = null;

  token(): string | null {
    return this.accessToken;
  }

  /** @param login tên đăng nhập (admin, guest...) hoặc email */
  async login(login: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<AuthResponse>(`${API_BASE}/auth/login`, { login, password }, { context: PUBLIC() }),
    );
    await this.startSession(res);
  }

  async register(email: string, password: string, displayName: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<AuthResponse>(
        `${API_BASE}/auth/register`,
        { email, password, displayName },
        { context: PUBLIC() },
      ),
    );
    await this.startSession(res);
  }

  /** Đăng nhập / đăng ký bằng Google (ID token từ Google Identity Services). Trả true nếu tài khoản vừa được tạo. */
  async loginWithGoogle(credential: string): Promise<boolean> {
    const res = await firstValueFrom(
      this.http.post<AuthResponse>(`${API_BASE}/auth/google`, { credential }, { context: PUBLIC() }),
    );
    await this.startSession(res);
    return res.newUser;
  }

  /** Đăng nhập / đăng ký bằng Facebook (access token từ Facebook SDK). Trả true nếu tài khoản vừa được tạo. */
  async loginWithFacebook(accessToken: string): Promise<boolean> {
    const res = await firstValueFrom(
      this.http.post<AuthResponse>(`${API_BASE}/auth/facebook`, { accessToken }, { context: PUBLIC() }),
    );
    await this.startSession(res);
    return res.newUser;
  }

  /** Lúc mở app: còn cookie refresh hợp lệ thì khôi phục phiên. */
  async restoreSession(): Promise<boolean> {
    return (await this.refreshAccessToken()) !== null;
  }

  /**
   * Đổi cookie refresh lấy access token mới. Trả null nếu phiên đã hết.
   *
   * Server xoay vòng refresh token: token cũ dùng lần hai bị coi là bị đánh cắp và cả phiên bị thu hồi. Trong một
   * tab chỉ refresh một lần (`refreshing`); giữa các tab thì xếp hàng bằng Web Locks: tab sau chờ tab trước xong,
   * lúc đó cookie đã là token mới nên không bao giờ hai tab cùng gửi một token cũ.
   */
  refreshAccessToken(): Promise<string | null> {
    this.refreshing ??= withCrossTabLock(() =>
      firstValueFrom(this.http.post<AuthResponse>(`${API_BASE}/auth/refresh`, null, { context: PUBLIC() })),
    )
      .then((res) => {
        this.setSession(res);
        return res.accessToken;
      })
      .catch(() => {
        this.clearSession();
        return null;
      })
      .finally(() => (this.refreshing = null));
    return this.refreshing;
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${API_BASE}/auth/logout`, null, { context: PUBLIC() }));
    } finally {
      this.endSession();
      await this.router.navigate(['/login']);
    }
  }

  /** Đăng xuất khỏi mọi thiết bị (thu hồi mọi refresh token của tài khoản). */
  async logoutAll(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${API_BASE}/auth/logout-all`, null));
    } finally {
      this.endSession();
      await this.router.navigate(['/login']);
    }
  }

  /** Sau khi lưu hồ sơ: cập nhật tên và ảnh hiện ở thanh menu, không cần đăng nhập lại. */
  updateProfile(displayName: string, avatarUrl: string | null): void {
    this.state.update((u) => (u ? { ...u, displayName, avatarUrl } : u));
  }

  /** Interceptor gọi khi refresh thất bại giữa chừng: về trang đăng nhập, giữ lại trang đang xem. */
  onSessionExpired(): void {
    if (!this.isLoggedIn() && this.router.url.startsWith('/login')) return;
    const returnUrl = this.router.url;
    this.endSession();
    void this.router.navigate(['/login'], { queryParams: { returnUrl } });
  }

  private async startSession(res: AuthResponse): Promise<void> {
    this.setSession(res);
    await this.bootstrap.loadAll();
  }

  private setSession(res: AuthResponse): void {
    this.accessToken = res.accessToken;
    this.state.set(res.user);
  }

  private clearSession(): void {
    this.accessToken = null;
    this.state.set(null);
  }

  private endSession(): void {
    this.clearSession();
    this.bootstrap.clear();
  }
}
