import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Route, Router, UrlSegment } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { LoginGate } from './login-gate.service';

describe('authGuard', () => {
  function run(opts: { loggedIn: boolean; navigated: boolean }) {
    const router = {
      url: '/explore',
      navigated: opts.navigated,
      navigateByUrl: vi.fn(),
      parseUrl: vi.fn((u: string) => `tree:${u}`),
      createUrlTree: vi.fn((cmds: string[], extras: unknown) => ({ cmds, extras })),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isLoggedIn: signal(opts.loggedIn) } },
        { provide: Router, useValue: router },
      ],
    });
    const route: Route = { path: 'plans', title: 'Plan · HANOIVIBE' };
    const result = TestBed.runInInjectionContext(() => authGuard(route, [new UrlSegment('plans', {})]));
    return { result, router, gate: TestBed.inject(LoginGate) };
  }

  it('đã đăng nhập thì vào', () => {
    expect(run({ loggedIn: true, navigated: true }).result).toBe(true);
  });

  it('khách bấm menu trong app: ở nguyên trang, mở popup, đăng nhập xong thì vào trang định vào', () => {
    const { result, router, gate } = run({ loggedIn: false, navigated: true });
    expect(result).toBe('tree:/explore');
    expect(gate.prompt()?.action).toBe('dùng Plan');
    gate.prompt()?.resume?.();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/plans');
  });

  it('khách mở thẳng đường dẫn: về /login', () => {
    const { result, gate } = run({ loggedIn: false, navigated: false });
    expect(result).toEqual({ cmds: ['/login'], extras: { queryParams: { returnUrl: '/plans' } } });
    expect(gate.prompt()).toBeNull();
  });
});
