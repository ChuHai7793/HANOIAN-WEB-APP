import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { idempotencyInterceptor } from './idempotency.interceptor';
import { IDEMPOTENCY_KEY } from './http-context';

describe('idempotencyInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([idempotencyInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('POST /api dùng key trong context, không có thì tự sinh', async () => {
    const withKey = firstValueFrom(
      http.post(
        '/api/v1/places',
        {},
        { context: new HttpContext().set(IDEMPOTENCY_KEY, 'key-12345678') },
      ),
    );
    const keyed = backend.expectOne('/api/v1/places');
    expect(keyed.request.headers.get('Idempotency-Key')).toBe('key-12345678');
    keyed.flush({});
    await withKey;

    const generated = firstValueFrom(http.post('/api/v1/girlfriends', {}));
    const req = backend.expectOne('/api/v1/girlfriends');
    expect(req.request.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    req.flush({});
    await generated;
  });

  it('bỏ qua /auth và các method khác POST', async () => {
    const login = firstValueFrom(http.post('/api/v1/auth/login', {}));
    const patch = firstValueFrom(http.patch('/api/v1/places/p1', {}));

    const loginReq = backend.expectOne('/api/v1/auth/login');
    const patchReq = backend.expectOne('/api/v1/places/p1');
    expect(loginReq.request.headers.has('Idempotency-Key')).toBe(false);
    expect(patchReq.request.headers.has('Idempotency-Key')).toBe(false);
    loginReq.flush({});
    patchReq.flush({});
    await Promise.all([login, patch]);
  });
});
