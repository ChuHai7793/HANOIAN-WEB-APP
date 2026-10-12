import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SpotService } from './spot.service';
import { errorInterceptor } from '../api/error.interceptor';
import { ToastService } from './toast.service';
import { durationText, spotPriceText } from '../models/spot.model';

describe('SpotService (Tìm chỗ chơi)', () => {
  let http: HttpTestingController;
  let service: SpotService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(SpotService);
  });

  afterEach(() => http.verify());

  it('chỉ gửi bộ lọc có giá trị; maxPrice 0 (miễn phí) vẫn được gửi', async () => {
    const result = service.search({ q: '', category: 'museum', maxPrice: 0, indoor: null, openAt: '10:30', page: 0 });
    const req = http.expectOne((r) => r.url === '/api/v1/spots');
    expect(req.request.params.has('q')).toBe(false);
    expect(req.request.params.has('indoor')).toBe(false);
    expect(req.request.params.get('category')).toBe('museum');
    expect(req.request.params.get('maxPrice')).toBe('0');
    expect(req.request.params.get('openAt')).toBe('10:30');
    req.flush({ items: [], total: 0, page: 0, size: 30 });
    expect((await result).total).toBe(0);
  });

  it('sửa bị trùng version (409) không hiện toast lỗi chung, để trang tự nạp lại', async () => {
    const toast = vi.spyOn(TestBed.inject(ToastService), 'error');
    const result = service.update('s1', {} as never);
    const req = http.expectOne('/api/v1/admin/spots/s1');
    expect(req.request.method).toBe('PUT');
    req.flush({ code: 'VERSION_CONFLICT' }, { status: 409, statusText: 'Conflict' });
    await expect(result).rejects.toBeTruthy();
    expect(toast).not.toHaveBeenCalled();
  });
});

describe('hiển thị giá và thời lượng chỗ chơi', () => {
  it('giá', () => {
    expect(spotPriceText({ priceFrom: 0, priceTo: null })).toBe('Miễn phí');
    expect(spotPriceText({ priceFrom: 40000, priceTo: null })).toBe('40k/người');
    expect(spotPriceText({ priceFrom: 150000, priceTo: 300000 })).toBe('150k–300k/người');
    expect(spotPriceText({ priceFrom: 0, priceTo: 50000 })).toBe('Đến 50k/người');
    expect(spotPriceText({ priceFrom: 1200000, priceTo: null })).toBe('1,2tr/người');
  });

  it('thời lượng', () => {
    expect(durationText(50)).toBe('50 phút');
    expect(durationText(90)).toBe('1h30');
    expect(durationText(120)).toBe('2h');
  });
});
