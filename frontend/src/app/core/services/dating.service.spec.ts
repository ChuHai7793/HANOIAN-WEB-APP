import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DatingService } from './dating.service';
import { errorInterceptor } from '../api/error.interceptor';
import { ToastService } from './toast.service';

describe('DatingService (quẹt, siêu thích, hôm nay)', () => {
  let http: HttpTestingController;
  let service: DatingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(DatingService);
  });

  afterEach(() => http.verify());

  it('gửi cờ superLike (mặc định false)', async () => {
    void service.swipe('u1', true);
    expect(http.expectOne('/api/v1/dating/swipes').request.body).toEqual({ targetId: 'u1', liked: true, superLike: false });
    const result = service.swipe('u2', true, true);
    const req = http.expectOne('/api/v1/dating/swipes');
    expect(req.request.body).toEqual({ targetId: 'u2', liked: true, superLike: true });
    req.flush({ matched: false, match: null });
    expect((await result).matched).toBe(false);
  });

  it('hết lượt siêu thích (429) không hiện toast lỗi chung, để trang tự báo', async () => {
    const toast = vi.spyOn(TestBed.inject(ToastService), 'error');
    const result = service.swipe('u1', true, true);
    http
      .expectOne('/api/v1/dating/swipes')
      .flush({ code: 'SUPER_LIKE_LIMIT' }, { status: 429, statusText: 'Too Many Requests' });
    await expect(result).rejects.toBeTruthy();
    expect(toast).not.toHaveBeenCalled();
  });

  it('lấy số trong ngày', async () => {
    const result = service.today();
    http.expectOne('/api/v1/dating/today').flush({ liked: 3, superLikesLeft: 1 });
    expect(await result).toEqual({ liked: 3, superLikesLeft: 1 });
  });
});
