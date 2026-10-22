import { TestBed } from '@angular/core/testing';
import { makeStateKey, TransferState } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BannerService } from './banner.service';

describe('BannerService (ảnh nền banner, nhớ suốt phiên)', () => {
  let http: HttpTestingController;

  function setup(transferred?: string | null): BannerService {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    if (transferred !== undefined)
      TestBed.inject(TransferState).set(makeStateKey<string | null>('banner:explore'), transferred);
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(BannerService);
  }

  afterEach(() => http.verify());

  it('chưa hỏi API thì chưa biết ảnh (ready false); hỏi xong thì nhớ, trang sau không gọi lại', async () => {
    const service = setup();
    expect(service.ready('explore')()).toBe(false);

    const first = service.load('explore');
    const second = service.load('explore');
    http.expectOne('/api/v1/catalog/banner').flush({ imageUrl: '/u/admin.webp' });
    await Promise.all([first, second]);

    expect(service.ready('explore')()).toBe(true);
    expect(service.custom('explore')()).toBe('/u/admin.webp');
    await service.load('explore');
    http.expectNone('/api/v1/catalog/banner');
  });

  it('trình duyệt đọc ảnh server gửi kèm (TransferState): biết ngay, không gọi API', async () => {
    const service = setup('/u/ssr.webp');
    expect(service.ready('explore')()).toBe(true);
    expect(service.custom('explore')()).toBe('/u/ssr.webp');
    await service.load('explore');
    http.expectNone('/api/v1/catalog/banner');
    // Trang Tìm chỗ chơi không bị ảnh hưởng
    expect(service.ready('spots')()).toBe(false);
  });

  it('admin đổi ảnh thì mọi trang dùng chung thấy ngay', async () => {
    const service = setup();
    const done = service.set('spots', '/u/new.webp');
    const req = http.expectOne('/api/v1/admin/spots/banner');
    expect(req.request.method).toBe('PUT');
    req.flush({ imageUrl: '/u/new.webp' });
    await done;
    expect(service.custom('spots')()).toBe('/u/new.webp');
    expect(service.ready('spots')()).toBe(true);
  });
});
