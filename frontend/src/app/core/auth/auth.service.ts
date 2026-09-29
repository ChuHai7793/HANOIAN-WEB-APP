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
}

interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  user: AuthUser;
}

/** Request tới /auth/login|register|refresh|logout: không gắn Bearer, tự xử lý lỗi. */
const PUBLIC = () => new HttpContext().set(SKIP_AUTH, true).set(SILENT_ERRORS, true);

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

  /** Lúc mở app: còn cookie refresh hợp lệ thì khôi phục phiên. */
  async restoreSession(): Promise<boolean> {
    return (await this.refreshAccessToken()) !== null;
  }

  /** Đổi cookie refresh lấy access token mới. Trả null nếu phiên đã hết. */
  refreshAccessToken(): Promise<string | null> {
    this.refreshing ??= firstValueFrom(
      this.http.post<AuthResponse>(`${API_BASE}/auth/refresh`, null, { context: PUBLIC() }),
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
