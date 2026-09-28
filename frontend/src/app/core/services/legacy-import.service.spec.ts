import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LEGACY_KEYS, LegacyImportService, readLegacyData } from './legacy-import.service';
import { DataBootstrapService } from './data-bootstrap.service';

const SEED_TIME = '2026-01-01T00:00:00.000Z';
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function seedLike(count: number, prefix: string) {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}_${i}`,
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
  }));
}

describe('readLegacyData', () => {
  beforeEach(() => localStorage.clear());

  it('không có key cũ thì null', () => {
    expect(readLegacyData(localStorage)).toBeNull();
  });

  it('bộ dữ liệu mẫu cũ còn nguyên thì coi như không có', () => {
    localStorage.setItem(LEGACY_KEYS.places, JSON.stringify(seedLike(10, 'place')));
    localStorage.setItem(LEGACY_KEYS.girlfriends, JSON.stringify(seedLike(2, 'gf')));
    localStorage.setItem(
      LEGACY_KEYS.placeLinks,
      JSON.stringify(seedLike(4, 'link').map(({ updatedAt, ...l }) => l)),
    );
    expect(readLegacyData(localStorage)).toBeNull();
  });

  it('có bản ghi đã sửa (hoặc số lượng khác mẫu) thì trả dữ liệu', () => {
    const places = seedLike(10, 'place');
    places[3].updatedAt = '2026-02-10T08:00:00.000Z';
    localStorage.setItem(LEGACY_KEYS.places, JSON.stringify(places));
    localStorage.setItem(LEGACY_KEYS.girlfriends, JSON.stringify(seedLike(2, 'gf')));

    const payload = readLegacyData(localStorage);
    expect(payload?.places).toHaveLength(10);
    expect(payload?.placeLinks).toEqual([]);
  });

  it('JSON hỏng thì bỏ qua key đó', () => {
    localStorage.setItem(LEGACY_KEYS.places, '{hỏng');
    localStorage.setItem(LEGACY_KEYS.girlfriends, JSON.stringify([{ id: 'gf_x', name: 'Lan' }]));
    expect(readLegacyData(localStorage)?.girlfriends).toHaveLength(1);
  });
});

describe('LegacyImportService', () => {
  let service: LegacyImportService;
  let http: HttpTestingController;
  const loadAll = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(LEGACY_KEYS.girlfriends, JSON.stringify([{ id: 'gf_x', name: 'Lan' }]));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DataBootstrapService, useValue: { loadAll } },
      ],
    });
    service = TestBed.inject(LegacyImportService);
    service.pollIntervalMs = 0;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('gửi dữ liệu, hỏi trạng thái tới khi DONE, rồi đổi tên key và tải lại dữ liệu', async () => {
    service.check();
    const offer = service.state();
    expect(offer.step).toBe('offer');
    const pending = service.start(offer.step === 'offer' ? offer.payload : (null as never));

    const post = http.expectOne('/api/v1/import/local-storage');
    expect(post.request.body.girlfriends).toHaveLength(1);
    post.flush({ jobId: 'j1' }, { status: 202, statusText: 'Accepted' });
    await tick();

    http
      .expectOne('/api/v1/import/jobs/j1')
      .flush({ id: 'j1', status: 'RUNNING', stats: null, error: null });
    await tick();
    await tick();
    const stats = {
      places: 0,
      girlfriends: 1,
      placeLinks: 0,
      images: 0,
      skipped: 0,
      skippedReasons: [],
    };
    http
      .expectOne('/api/v1/import/jobs/j1')
      .flush({ id: 'j1', status: 'DONE', stats, error: null });
    await pending;

    expect(service.state()).toEqual({ step: 'done', stats });
    expect(loadAll).toHaveBeenCalled();
    expect(localStorage.getItem(LEGACY_KEYS.girlfriends)).toBeNull();
    expect(localStorage.getItem(LEGACY_KEYS.girlfriends + '.imported')).toContain('Lan');
  });

  it('server báo đang có import khác (423) thì báo lỗi, giữ nguyên dữ liệu cũ', async () => {
    service.check();
    const s = service.state();
    const pending = service.start(s.step === 'offer' ? s.payload : (null as never));
    http
      .expectOne('/api/v1/import/local-storage')
      .flush({ code: 'IMPORT_RUNNING' }, { status: 423, statusText: 'Locked' });
    await pending;

    expect(service.state().step).toBe('failed');
    expect(localStorage.getItem(LEGACY_KEYS.girlfriends)).toContain('Lan');
  });

  it('"Không nhập" thì không hỏi lại nhưng vẫn giữ dữ liệu dưới tên khác', () => {
    service.check();
    service.dismiss();
    expect(service.state().step).toBe('none');
    expect(readLegacyData(localStorage)).toBeNull();
    expect(localStorage.getItem(LEGACY_KEYS.girlfriends + '.skipped')).toContain('Lan');
  });
});
