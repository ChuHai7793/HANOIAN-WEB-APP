import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PlaceService } from './place.service';
import { GirlfriendService } from './girlfriend.service';
import { Place } from '../models/place.model';
import { Girlfriend } from '../models/girlfriend.model';

function place(overrides: Partial<Place> = {}): Place {
  return {
    id: 'p1',
    type: 'cafe',
    name: 'Cộng',
    address: '',
    priceRange: 'medium',
    rating: 4,
    openTime: '07:30',
    closeTime: '23:00',
    imageUrl: '',
    note: '',
    googleMapsUrl: '',
    lat: null,
    lng: null,
    version: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('CrudStore (qua PlaceService)', () => {
  let store: PlaceService;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(PlaceService);
    http = TestBed.inject(HttpTestingController);

    const loading = store.load();
    http.expectOne('/api/v1/places').flush([place()]);
    await loading;
  });

  afterEach(() => http.verify());

  it('load đổ dữ liệu vào signal và các computed', () => {
    expect(store.items()).toHaveLength(1);
    expect(store.cafes()).toHaveLength(1);
    expect(store.loaded()).toBe(true);
  });

  it('create gửi body không có field chỉ đọc và thêm bản server trả về', async () => {
    const { id, ...data } = place({ id: '', name: 'Mới' });
    const pending = store.create(data);

    const req = http.expectOne('/api/v1/places');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).not.toHaveProperty('version');
    expect(req.request.body).not.toHaveProperty('createdAt');
    req.flush(place({ id: 'p2', name: 'Mới' }));

    await pending;
    expect(store.byId('p2')?.name).toBe('Mới');
    expect(store.items()).toHaveLength(2);
  });

  it('update cập nhật ngay (optimistic), gửi kèm version, rồi lấy bản của server', async () => {
    const pending = store.update('p1', { name: 'Sửa' });
    expect(store.byId('p1')?.name).toBe('Sửa');

    const req = http.expectOne('/api/v1/places/p1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ name: 'Sửa', version: 0 });
    req.flush(place({ name: 'Sửa', version: 1 }));

    await pending;
    expect(store.byId('p1')?.version).toBe(1);
  });

  it('update gặp VERSION_CONFLICT thì thay bằng bản current của server và ném lỗi', async () => {
    const pending = store.update('p1', { name: 'Của tôi' });
    http
      .expectOne('/api/v1/places/p1')
      .flush(
        { code: 'VERSION_CONFLICT', current: place({ name: 'Của máy khác', version: 3 }) },
        { status: 409, statusText: 'Conflict' },
      );

    await expect(pending).rejects.toBeTruthy();
    expect(store.byId('p1')?.name).toBe('Của máy khác');
    expect(store.byId('p1')?.version).toBe(3);
  });

  it('update lỗi khác thì hoàn tác về bản cũ', async () => {
    const pending = store.update('p1', { name: 'Hỏng' });
    http
      .expectOne('/api/v1/places/p1')
      .flush({ code: 'VALIDATION_FAILED' }, { status: 400, statusText: 'Bad Request' });

    await expect(pending).rejects.toBeTruthy();
    expect(store.byId('p1')?.name).toBe('Cộng');
  });

  it('remove xoá ngay, lỗi mạng thì trả lại', async () => {
    const pending = store.remove('p1');
    expect(store.items()).toHaveLength(0);
    http.expectOne('/api/v1/places/p1').flush(null, { status: 500, statusText: 'Server Error' });

    await expect(pending).rejects.toBeTruthy();
    expect(store.byId('p1')).toBeTruthy();
  });

  it('remove gặp 404 (đã bị xoá ở nơi khác) vẫn coi là thành công', async () => {
    const pending = store.remove('p1');
    http
      .expectOne('/api/v1/places/p1')
      .flush({ code: 'NOT_FOUND' }, { status: 404, statusText: 'Not Found' });

    await pending;
    expect(store.items()).toHaveLength(0);
  });
});

describe('GirlfriendService chuẩn hoá ngày', () => {
  it("null từ server thành '' và '' gửi lên thành null", async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const store = TestBed.inject(GirlfriendService);
    const http = TestBed.inject(HttpTestingController);

    const loading = store.load();
    http.expectOne('/api/v1/girlfriends').flush([
      { id: 'g1', name: 'Mai', birthday: null, startedDate: '2025-02-14', hobbies: [], version: 0 },
    ]);
    await loading;
    expect(store.byId('g1')?.birthday).toBe('');

    const pending = store.update('g1', { birthday: '', nickname: 'Mèo' } as Partial<Girlfriend>);
    const req = http.expectOne('/api/v1/girlfriends/g1');
    expect(req.request.body).toEqual({ birthday: null, nickname: 'Mèo', version: 0 });
    req.flush({ id: 'g1', name: 'Mai', birthday: null, startedDate: '2025-02-14', hobbies: [], version: 1 });
    await pending;
    http.verify();
  });
});
