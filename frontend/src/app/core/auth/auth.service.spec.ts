import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService, AuthUser } from './auth.service';
import { DataBootstrapService } from '../services/data-bootstrap.service';

function user(role: AuthUser['role']): AuthUser {
  return {
    id: 'u1',
    email: `${role.toLowerCase()}@gfmaster.local`,
    username: role.toLowerCase(),
    displayName: role,
    role,
    avatarUrl: null,
  };
}

describe('AuthService phân quyền', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: DataBootstrapService,
          useValue: { loadAll: vi.fn().mockResolvedValue(undefined), clear: vi.fn() },
        },
      ],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function loginAs(role: AuthUser['role']): Promise<void> {
    const pending = auth.login(role.toLowerCase(), 'x');
    const req = http.expectOne('/api/v1/auth/login');
    // Gửi field "login": server nhận cả tên đăng nhập lẫn email
    expect(req.request.body).toEqual({ login: role.toLowerCase(), password: 'x' });
    req.flush({ accessToken: 't', expiresIn: 900, user: user(role) });
    await pending;
  }

  it('chưa đăng nhập thì không sửa được', () => {
    expect(auth.canEdit()).toBe(false);
  });

  it('admin thì hiện nút thêm/sửa/xoá', async () => {
    await loginAs('ADMIN');
    expect(auth.canEdit()).toBe(true);
  });

  it('guest thì chỉ xem', async () => {
    await loginAs('GUEST');
    expect(auth.user()?.role).toBe('GUEST');
    expect(auth.canEdit()).toBe(false);
  });

  it('đăng nhập Google / Facebook: gửi credential, mở phiên, báo tài khoản mới hay cũ', async () => {
    const google = auth.loginWithGoogle('id-token');
    const g = http.expectOne('/api/v1/auth/google');
    expect(g.request.body).toEqual({ credential: 'id-token' });
    g.flush({ accessToken: 't1', expiresIn: 900, user: user('GUEST'), newUser: true });
    expect(await google).toBe(true);
    expect(auth.isLoggedIn()).toBe(true);
    expect(auth.token()).toBe('t1');

    const facebook = auth.loginWithFacebook('fb-token');
    const fb = http.expectOne('/api/v1/auth/facebook');
    expect(fb.request.body).toEqual({ accessToken: 'fb-token' });
    fb.flush({ accessToken: 't2', expiresIn: 900, user: user('GUEST'), newUser: false });
    expect(await facebook).toBe(false);
    expect(auth.token()).toBe('t2');
  });
});
