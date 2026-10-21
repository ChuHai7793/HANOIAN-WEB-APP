import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SocialLoginService } from './social-login.service';

describe('SocialLoginService', () => {
  let service: SocialLoginService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SocialLoginService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('hỏi backend một lần cách đăng nhập nào đang bật', async () => {
    const first = service.providers();
    const second = service.providers();
    http.expectOne('/api/v1/auth/providers').flush({ googleClientId: 'g-1', facebookAppId: null });
    expect(await first).toEqual({ googleClientId: 'g-1', facebookAppId: null });
    expect(await second).toEqual({ googleClientId: 'g-1', facebookAppId: null });
  });

  it('backend lỗi thì coi như không có cách nào, không ném lỗi', async () => {
    const pending = service.providers();
    http.expectOne('/api/v1/auth/providers').flush('x', { status: 500, statusText: 'err' });
    expect(await pending).toEqual({ googleClientId: null, facebookAppId: null });
  });
});
