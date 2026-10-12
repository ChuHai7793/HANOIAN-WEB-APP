import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CatalogService } from './catalog.service';
import { errorInterceptor } from '../api/error.interceptor';
import { ToastService } from './toast.service';

describe('CatalogService (Khám phá quán)', () => {
  let http: HttpTestingController;
  let service: CatalogService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(CatalogService);
  });

  afterEach(() => http.verify());

  it('chỉ gửi bộ lọc có giá trị', async () => {
    const result = service.search({ q: 'giảng', type: '', district: 'HOAN_KIEM', page: 0, size: 30 });
    const req = http.expectOne((r) => r.url === '/api/v1/catalog');
    expect(req.request.params.get('q')).toBe('giảng');
    expect(req.request.params.has('type')).toBe(false);
    expect(req.request.params.get('district')).toBe('HOAN_KIEM');
    req.flush({ items: [], total: 0, page: 0, size: 30 });
    expect((await result).total).toBe(0);
  });

  it('số theo loại chỉ gửi từ khoá và khu vực', async () => {
    const result = service.counts({ q: '', district: 'BA_DINH' });
    const req = http.expectOne((r) => r.url === '/api/v1/catalog/counts');
    expect(req.request.params.has('q')).toBe(false);
    expect(req.request.params.get('district')).toBe('BA_DINH');
    req.flush({ all: 2, cafe: 1, bar: 1, restaurant: 0 });
    expect((await result).cafe).toBe(1);
  });

  it('add vào My place: quán đã có (409) không hiện toast lỗi chung, để trang tự báo', async () => {
    const toast = vi.spyOn(TestBed.inject(ToastService), 'error');
    const result = service.addToMyPlace('c1');
    const req = http.expectOne('/api/v1/catalog/c1/my-place');
    expect(req.request.method).toBe('POST');
    req.flush({ code: 'ALREADY_IN_MY_PLACE' }, { status: 409, statusText: 'Conflict' });
    await expect(result).rejects.toBeTruthy();
    expect(toast).not.toHaveBeenCalled();
  });

  it('admin sửa quán: PUT kèm version', async () => {
    const result = service.update('c1', {
      type: 'cafe',
      district: 'BA_DINH',
      name: 'Cafe',
      address: '',
      priceRange: 'medium',
      rating: 4,
      openTime: '07:00',
      closeTime: '22:00',
      imageUrl: '',
      note: '',
      googleMapsUrl: '',
      lat: null,
      lng: null,
      version: 2,
    });
    const req = http.expectOne('/api/v1/admin/catalog/c1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.version).toBe(2);
    expect(req.request.body.district).toBe('BA_DINH');
    req.flush({ id: 'c1' });
    await result;
  });
});
