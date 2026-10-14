import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { UploadService } from './upload.service';

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('UploadService (upload thẳng lên storage)', () => {
  let service: UploadService;
  let http: HttpTestingController;
  const file = new Blob([new Uint8Array(1234)], { type: 'image/webp' });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(UploadService);
    service.pollIntervalMs = 0;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function beginAndPut(uploadUrl: string, completed: object = { id: 'u1', status: 'PROCESSING' }) {
    const begin = http.expectOne('/api/v1/uploads/direct');
    expect(begin.request.body).toEqual({ contentType: 'image/webp', sizeBytes: 1234 });
    begin.flush({
      id: 'u1',
      uploadUrl,
      method: 'PUT',
      headers: { 'Content-Type': 'image/webp' },
      expiresAt: '',
    });
    await tick();

    const put = http.expectOne(uploadUrl);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toBe(file);
    expect(put.request.headers.get('Content-Type')).toBe('image/webp');
    put.flush('');
    await tick();

    http.expectOne('/api/v1/uploads/u1/complete').flush(completed);
    await tick();
  }

  it('PUT thẳng lên presigned URL của storage rồi chờ server xử lý xong', async () => {
    const pending = service.uploadImage(file);
    await beginAndPut('https://gfm-incoming.r2.example.com/u/abc?X-Amz-Signature=xyz');

    http.expectOne('/api/v1/uploads/u1').flush({ id: 'u1', status: 'PROCESSING', url: null });
    await tick();
    await tick();
    http
      .expectOne('/api/v1/uploads/u1')
      .flush({
        id: 'u1',
        status: 'READY',
        url: 'https://img.example.com/u/a.webp',
        sizeBytes: 900,
      });

    expect((await pending).url).toBe('https://img.example.com/u/a.webp');
  });

  it('WebP sạch: complete trả URL luôn, không phải hỏi lại (thumbnail làm ở nền)', async () => {
    const pending = service.uploadImage(file);
    await beginAndPut('/api/v1/uploads/u1/content', {
      id: 'u1',
      status: 'THUMB_PENDING',
      url: 'https://img.example.com/u/b.webp',
      sizeBytes: 1234,
    });

    expect((await pending).url).toBe('https://img.example.com/u/b.webp');
    http.expectNone('/api/v1/uploads/u1');
  });

  it('gửi kèm loại ảnh và tên gợi ý để server đặt tên file dễ đọc', async () => {
    const pending = service.uploadImage(file, undefined, { purpose: 'place', name: 'Cafe Cuối Ngõ' });
    const begin = http.expectOne('/api/v1/uploads/direct');
    expect(begin.request.body).toEqual({ contentType: 'image/webp', sizeBytes: 1234, purpose: 'place', name: 'Cafe Cuối Ngõ' });
    begin.flush({ id: 'u1', uploadUrl: '/api/v1/uploads/u1/content', method: 'PUT', headers: {}, expiresAt: '' });
    await tick();
    http.expectOne('/api/v1/uploads/u1/content').flush('');
    await tick();
    http.expectOne('/api/v1/uploads/u1/complete').flush({ id: 'u1', status: 'READY', url: '/uploads/places/2026/10/cafe-cuoi-ngo-k3f9a1c2.webp' });
    expect((await pending).url).toContain('cafe-cuoi-ngo');
  });

  it('server báo ảnh hỏng (FAILED) thì ném lỗi', async () => {
    const pending = service.uploadImage(file);
    await beginAndPut('/api/v1/uploads/u1/content');
    http.expectOne('/api/v1/uploads/u1').flush({ id: 'u1', status: 'FAILED', url: null });

    await expect(pending).rejects.toThrow('không phải ảnh');
  });
});
