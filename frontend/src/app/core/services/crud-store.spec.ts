import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PlaceService } from './place.service';
import { GirlfriendService } from './girlfriend.service';
import { ConflictService } from './conflict.service';
import { IDEMPOTENCY_KEY, SILENT_CODES } from '../api/http-context';
import { Place } from '../models/place.model';
import { Girlfriend } from '../models/girlfriend.model';

/** Chờ chuỗi Promise trong store chạy tới bước kế tiếp */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

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

  it('create gửi lại cùng dữ liệu sau lỗi thì dùng lại Idempotency-Key cũ', async () => {
    const { id, ...data } = place({ id: '', name: 'Mới' });

    const first = store.create(data);
    const req1 = http.expectOne('/api/v1/places');
    const key = req1.request.context.get(IDEMPOTENCY_KEY);
    expect(key).toBeTruthy();
    req1.error(new ProgressEvent('error')); // mất mạng, không biết server đã tạo chưa
    await expect(first).rejects.toBeTruthy();

    const retry = store.create(data);
    const req2 = http.expectOne('/api/v1/places');
    expect(req2.request.context.get(IDEMPOTENCY_KEY)).toBe(key);
    req2.flush(place({ id: 'p2', name: 'Mới' }));
    await retry;

    // Thành công rồi thì lần tạo sau (dù cùng dữ liệu) là một bản ghi mới, key mới
    const again = store.create(data);
    const req3 = http.expectOne('/api/v1/places');
    expect(req3.request.context.get(IDEMPOTENCY_KEY)).not.toBe(key);
    req3.flush(place({ id: 'p3', name: 'Mới' }));
    await again;
    expect(store.items()).toHaveLength(3);
  });

  describe('update gặp VERSION_CONFLICT', () => {
    let conflicts: ConflictService;
    const other = place({ name: 'Của máy khác', version: 3 });

    beforeEach(() => (conflicts = TestBed.inject(ConflictService)));

    function conflict(current: Place | null = other) {
      const req = http.expectOne('/api/v1/places/p1');
      expect(req.request.context.get(SILENT_CODES)).toContain('VERSION_CONFLICT');
      req.flush(
        { code: 'VERSION_CONFLICT', current: current ?? undefined },
        { status: 409, statusText: 'Conflict' },
      );
    }

    it('hiện dialog; "Tải bản mới" thì giữ bản server', async () => {
      const pending = store.update('p1', { name: 'Của tôi' });
      conflict();
      await tick();

      expect(conflicts.pending()).toEqual({ name: 'Của máy khác' });
      expect(store.byId('p1')?.name).toBe('Của máy khác');
      conflicts.choose('reload');

      expect(await pending).toMatchObject({ name: 'Của máy khác', version: 3 });
      expect(conflicts.pending()).toBeNull();
    });

    it('"Ghi đè" thì gửi lại thay đổi với version mới của server', async () => {
      const pending = store.update('p1', { name: 'Của tôi' });
      conflict();
      await tick();
      conflicts.choose('overwrite');
      await tick();

      const retry = http.expectOne('/api/v1/places/p1');
      expect(retry.request.body).toEqual({ name: 'Của tôi', version: 3 });
      retry.flush(place({ name: 'Của tôi', version: 4 }));

      expect(await pending).toMatchObject({ name: 'Của tôi', version: 4 });
      expect(store.byId('p1')?.version).toBe(4);
    });

    it('server không kèm current thì tự tải bản mới nhất', async () => {
      const pending = store.update('p1', { name: 'Của tôi' });
      conflict(null);
      await tick();

      const get = http.expectOne('/api/v1/places/p1');
      expect(get.request.method).toBe('GET');
      get.flush(other);
      await tick();

      conflicts.choose('reload');
      expect(await pending).toMatchObject({ version: 3 });
    });
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
    http
      .expectOne('/api/v1/girlfriends')
      .flush([
        {
          id: 'g1',
          name: 'Mai',
          birthday: null,
          startedDate: '2025-02-14',
          hobbies: [],
          version: 0,
        },
      ]);
    await loading;
    expect(store.byId('g1')?.birthday).toBe('');

    const pending = store.update('g1', { birthday: '', nickname: 'Mèo' } as Partial<Girlfriend>);
    const req = http.expectOne('/api/v1/girlfriends/g1');
    expect(req.request.body).toEqual({ birthday: null, nickname: 'Mèo', version: 0 });
    req.flush({
      id: 'g1',
      name: 'Mai',
      birthday: null,
      startedDate: '2025-02-14',
      hobbies: [],
      version: 1,
    });
    await pending;
    http.verify();
  });
});
