import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MapsService } from './maps.service';
import { SILENT_ERRORS } from '../api/http-context';

describe('MapsService', () => {
  it('gọi /maps/resolve với url làm tham số, không hiện toast chung khi lỗi', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const maps = TestBed.inject(MapsService);
    const http = TestBed.inject(HttpTestingController);

    const pending = maps.resolve('https://maps.app.goo.gl/AbC123');
    const req = http.expectOne((r) => r.url === '/api/v1/maps/resolve');
    expect(req.request.params.get('url')).toBe('https://maps.app.goo.gl/AbC123');
    expect(req.request.context.get(SILENT_ERRORS)).toBe(true);
    req.flush({
      lat: 21.03,
      lng: 105.85,
      resolvedUrl: 'https://www.google.com/maps/@21.03,105.85,17z',
    });

    expect(await pending).toMatchObject({ lat: 21.03, lng: 105.85 });
    http.verify();
  });
});
