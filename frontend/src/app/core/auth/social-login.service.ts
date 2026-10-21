import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpContext } from '@angular/common/http';
import { DOCUMENT, inject, Injectable, PLATFORM_ID } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from '../api/api';
import { SILENT_ERRORS, SKIP_AUTH } from '../api/http-context';

/** Cách đăng nhập ngoài backend đang bật; id là thông tin công khai để nạp SDK. null = ẩn nút. */
export interface SocialProviders {
  googleClientId: string | null;
  facebookAppId: string | null;
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const FB_SRC = 'https://connect.facebook.net/vi_VN/sdk.js';
const FB_VERSION = 'v21.0';

/** Phần của Google Identity Services và Facebook JS SDK mà app dùng */
interface GoogleAccounts {
  accounts: {
    id: {
      initialize(config: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: 'popup'; itp_support?: boolean }): void;
      renderButton(el: HTMLElement, options: Record<string, string | number>): void;
    };
  };
}
interface FacebookSdk {
  init(config: { appId: string; version: string; cookie: boolean; xfbml: boolean }): void;
  login(cb: (r: { status: string; authResponse?: { accessToken: string } }) => void, options: { scope: string }): void;
}
declare global {
  interface Window {
    google?: GoogleAccounts;
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

/**
 * Nạp SDK của Google / Facebook (chỉ khi cần, chỉ trên trình duyệt) và lấy credential để gửi cho backend:
 * Google trả ID token (JWT), Facebook trả access token. Backend tự xác minh với nhà cung cấp, frontend không giữ
 * gì ngoài phiên HANOIVIBE như đăng nhập thường.
 */
@Injectable({ providedIn: 'root' })
export class SocialLoginService {
  private readonly http = inject(HttpClient);
  private readonly doc = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  private providersPromise: Promise<SocialProviders> | null = null;
  private google: Promise<GoogleAccounts | null> | null = null;
  private facebook: Promise<FacebookSdk | null> | null = null;
  /** Nút Google đang hiện trên trang: GIS chỉ initialize một lần, callback chuyển tiếp tới nút hiện tại */
  private onGoogleCredential: ((credential: string) => void) | null = null;

  /** Hỏi backend một lần; lỗi mạng thì coi như không có cách nào (form email/mật khẩu vẫn dùng được). */
  providers(): Promise<SocialProviders> {
    this.providersPromise ??= firstValueFrom(
      this.http.get<SocialProviders>(`${API_BASE}/auth/providers`, {
        context: new HttpContext().set(SKIP_AUTH, true).set(SILENT_ERRORS, true),
      }),
    ).catch(() => ({ googleClientId: null, facebookAppId: null }));
    return this.providersPromise;
  }

  /** Vẽ nút chuẩn của Google vào `host`; trả false nếu không nạp được SDK (bị chặn, mất mạng). */
  async renderGoogleButton(host: HTMLElement, clientId: string, onCredential: (credential: string) => void): Promise<boolean> {
    const gis = await this.loadGoogle(clientId);
    if (!gis) return false;
    this.onGoogleCredential = onCredential;
    gis.accounts.id.renderButton(host, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      logo_alignment: 'left',
      locale: 'vi',
      width: Math.min(400, Math.max(200, Math.floor(host.clientWidth || 320))),
    });
    return true;
  }

  /** Mở popup Facebook; trả access token, null nếu người dùng huỷ hoặc SDK không nạp được. */
  async facebookLogin(appId: string): Promise<string | null> {
    const fb = await this.loadFacebook(appId);
    if (!fb) return null;
    return new Promise((resolve) => fb.login((r) => resolve(r.status === 'connected' ? (r.authResponse?.accessToken ?? null) : null), { scope: 'public_profile,email' }));
  }

  private loadGoogle(clientId: string): Promise<GoogleAccounts | null> {
    if (!this.browser) return Promise.resolve(null);
    this.google ??= this.script(GIS_SRC).then((ok) => {
      const gis = ok ? (this.doc.defaultView?.google ?? null) : null;
      gis?.accounts.id.initialize({
        client_id: clientId,
        ux_mode: 'popup',
        itp_support: true,
        callback: (r) => this.onGoogleCredential?.(r.credential),
      });
      return gis;
    });
    return this.google;
  }

  private loadFacebook(appId: string): Promise<FacebookSdk | null> {
    if (!this.browser) return Promise.resolve(null);
    this.facebook ??= new Promise<FacebookSdk | null>((resolve) => {
      const win = this.doc.defaultView;
      if (!win) return resolve(null);
      win.fbAsyncInit = () => {
        win.FB?.init({ appId, version: FB_VERSION, cookie: false, xfbml: false });
        resolve(win.FB ?? null);
      };
      void this.script(FB_SRC).then((ok) => {
        if (!ok) resolve(null);
      });
    });
    return this.facebook;
  }

  /** Chèn script một lần; false nếu không tải được (tiện ích chặn, mạng công ty) */
  private script(src: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.doc.querySelector(`script[src="${src}"]`)) return resolve(true);
      const el = this.doc.createElement('script');
      el.src = src;
      el.async = true;
      el.defer = true;
      el.onload = () => resolve(true);
      el.onerror = () => resolve(false);
      this.doc.head.appendChild(el);
    });
  }
}
