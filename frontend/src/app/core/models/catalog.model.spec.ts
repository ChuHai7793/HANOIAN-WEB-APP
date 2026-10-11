import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { cuisineOption, openingHoursRange } from './catalog.model';
import { CatalogService } from '../services/catalog.service';

describe('Khám phá quán: chuyển dữ liệu OSM sang form quán', () => {
  it('giờ mở cửa: lấy khoảng giờ đầu tiên, 24:00 thành 23:59', () => {
    expect(openingHoursRange('Mo-Su 07:00-22:00')).toEqual({ open: '07:00', close: '22:00' });
    expect(openingHoursRange('7:30-24:00')).toEqual({ open: '07:30', close: '23:59' });
    expect(openingHoursRange('Mo-Fr 08:00-12:00,13:30-17:00')).toEqual({ open: '08:00', close: '12:00' });
    expect(openingHoursRange('24/7')).toBeNull();
    expect(openingHoursRange(null)).toBeNull();
  });

  it('loại món OSM khớp lựa chọn trong form, không khớp thì bỏ trống', () => {
    expect(cuisineOption('vietnamese, noodle')).toBe('Món Việt');
    expect(cuisineOption('Korean')).toBe('Món Hàn');
    expect(cuisineOption('pizza')).toBe('Món Âu');
    expect(cuisineOption('coffee_shop')).toBeUndefined();
    expect(cuisineOption(null)).toBeUndefined();
  });
});

describe('CatalogService', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('chỉ gửi bộ lọc có giá trị', async () => {
    const result = TestBed.inject(CatalogService).search({ q: 'giảng', type: '', district: 'HOAN_KIEM', page: 0, size: 30 });
    const req = http.expectOne((r) => r.url === '/api/v1/catalog');
    expect(req.request.params.get('q')).toBe('giảng');
    expect(req.request.params.has('type')).toBe(false);
    expect(req.request.params.get('district')).toBe('HOAN_KIEM');
    expect(req.request.params.get('page')).toBe('0');
    req.flush({ items: [], total: 0, page: 0, size: 30, lastFetchedAt: null });
    expect((await result).total).toBe(0);
  });
});
