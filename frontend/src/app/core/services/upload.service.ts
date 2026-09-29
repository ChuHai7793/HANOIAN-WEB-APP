import { HttpClient, HttpEventType, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, lastValueFrom, tap } from 'rxjs';
import { API_BASE } from '../api/api';

export type UploadStatus = 'AWAITING_UPLOAD' | 'PROCESSING' | 'READY' | 'THUMB_PENDING' | 'FAILED';

export interface UploadResult {
  id: string;
  /** null cho tới khi server xử lý xong */
  url: string | null;
  thumbUrl: string | null;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  status: UploadStatus;
}

interface DirectUpload {
  id: string;
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: string;
}

/**
 * Upload thẳng lên storage:
 * 1. POST /uploads/direct → nhận `uploadUrl` (presigned URL của R2/S3; khi chạy local là
 *    /api/v1/uploads/{id}/content của backend).
 * 2. PUT ảnh lên `uploadUrl` (không đi qua backend khi dùng S3).
 * 3. POST /uploads/{id}/complete → server xử lý ở nền (xoay EXIF, 1200px, WebP, bỏ GPS, thumbnail).
 * 4. Hỏi GET /uploads/{id} tới khi READY.
 */
@Injectable({ providedIn: 'root' })
export class UploadService {
  private readonly http = inject(HttpClient);

  /** Có thể chỉnh trong test để không phải chờ thật. */
  pollIntervalMs = 500;
  pollTimeoutMs = 30_000;

  async uploadImage(file: Blob, onProgress?: (percent: number) => void): Promise<UploadResult> {
    const direct = await firstValueFrom(
      this.http.post<DirectUpload>(`${API_BASE}/uploads/direct`, {
        contentType: file.type,
        sizeBytes: file.size,
      }),
    );

    // URL của storage (tên miền khác): authInterceptor không gắn Bearer vì không phải /api
    await lastValueFrom(
      this.http
        .request(direct.method, direct.uploadUrl, {
          body: file,
          headers: new HttpHeaders(direct.headers),
          reportProgress: true,
          observe: 'events',
          responseType: 'text',
        })
        .pipe(
          tap((event) => {
            if (event.type === HttpEventType.UploadProgress && event.total) {
              onProgress?.(Math.round((100 * event.loaded) / event.total));
            }
          }),
        ),
    );

    await firstValueFrom(
      this.http.post<UploadResult>(`${API_BASE}/uploads/${direct.id}/complete`, {}),
    );
    return this.waitUntilProcessed(direct.id);
  }

  private async waitUntilProcessed(id: string): Promise<UploadResult> {
    const deadline = Date.now() + this.pollTimeoutMs;
    for (;;) {
      const upload = await firstValueFrom(this.http.get<UploadResult>(`${API_BASE}/uploads/${id}`));
      if (upload.status === 'READY' && upload.url) return upload;
      if (upload.status === 'FAILED')
        throw new Error('File này không phải ảnh JPG, PNG hoặc WebP hợp lệ.');
      if (Date.now() > deadline) throw new Error('Server xử lý ảnh quá lâu, thử lại sau.');
      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }
  }
}
