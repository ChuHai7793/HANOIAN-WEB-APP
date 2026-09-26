import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../auth/auth.service';

const USER = { id: 'u1', email: 'mai@test.local', displayName: 'Mai' };

/** Chờ mọi microtask (chuỗi Promise của refresh) chạy xong */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => backend.verify());

  async function loginAs(token: string): Promise<void> {
    const pending = auth.login('mai@test.local', 'x');
    const req = backend.expectOne('/api/v1/auth/login');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ accessToken: token, expiresIn: 900, user: USER });
    // login() tải dữ liệu ngay sau đó
    await tick();
    for (const url of ['/api/v1/places', '/api/v1/girlfriends', '/api/v1/place-links']) {
      backend.expectOne(url).flush([]);
    }
    await pending;
  }

  it('gắn Bearer cho request /api', async () => {
    await loginAs('tok-1');
    const pending = firstValueFrom(http.get('/api/v1/stats'));
    const req = backend.expectOne('/api/v1/stats');
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok-1');
    req.flush({});
    await pending;
  });

  it('không gắn Bearer cho request ngoài /api', async () => {
    await loginAs('tok-1');
    const pending = firstValueFrom(http.get('/uploads/a.webp', { responseType: 'blob' }));
    const req = backend.expectOne('/uploads/a.webp');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(new Blob());
    await pending;
  });

  it('nhiều request cùng gặp 401 chỉ refresh một lần rồi gửi lại với token mới', async () => {
    await loginAs('old');
    const a = firstValueFrom(http.get('/api/v1/places'));
    const b = firstValueFrom(http.get('/api/v1/girlfriends'));

    backend.expectOne('/api/v1/places').flush({ code: 'TOKEN_EXPIRED' }, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/api/v1/girlfriends').flush({ code: 'TOKEN_EXPIRED' }, { status: 401, statusText: 'Unauthorized' });

    await tick();
    const refresh = backend.match('/api/v1/auth/refresh');
    expect(refresh).toHaveLength(1);
    refresh[0].flush({ accessToken: 'new', expiresIn: 900, user: USER });
    await tick();

    const retryA = backend.expectOne('/api/v1/places');
    const retryB = backend.expectOne('/api/v1/girlfriends');
    expect(retryA.request.headers.get('Authorization')).toBe('Bearer new');
    expect(retryB.request.headers.get('Authorization')).toBe('Bearer new');
    retryA.flush([]);
    retryB.flush([]);
    await Promise.all([a, b]);
  });

  it('refresh thất bại thì kết thúc phiên và về /login', async () => {
    await loginAs('old');
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const pending = firstValueFrom(http.get('/api/v1/places'));
    backend.expectOne('/api/v1/places').flush({ code: 'TOKEN_EXPIRED' }, { status: 401, statusText: 'Unauthorized' });
    await tick();
    backend
      .expectOne('/api/v1/auth/refresh')
      .flush({ code: 'UNAUTHORIZED' }, { status: 401, statusText: 'Unauthorized' });

    await expect(pending).rejects.toBeTruthy();
    expect(auth.isLoggedIn()).toBe(false);
    expect(auth.token()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login'], expect.anything());
  });
});
