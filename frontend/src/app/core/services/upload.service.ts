import { HttpClient, HttpEventType, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, lastValueFrom, tap } from 'rxjs';
import { API_BASE } from '../api/api';
import { fileToCompressedBlob } from '../utils/image';

export type UploadStatus = 'AWAITING_UPLOAD' | 'PROCESSING' | 'READY' | 'THUMB_PENDING' | 'FAILED';

/** Ảnh dùng vào việc gì: quyết định thư mục trên storage (places/, spots/, avatars/…) */
export type ImagePurpose = 'place' | 'spot' | 'avatar' | 'dating' | 'girlfriend';

/** Thông tin để server đặt tên file dễ đọc, vd. places/2026/10/cafe-cuoi-ngo-k3f9a1c2.webp */
export interface UploadMeta {
  purpose?: ImagePurpose;
  /** Tên quán, tên người…; trống thì dùng tên file gốc */
  name?: string;
}

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
 * 3. POST /uploads/{id}/complete. Ảnh đã nén sẵn thành WebP sạch (thường gặp, xem fileToCompressedBlob):
 *    server lưu luôn và trả `url` ngay. Còn lại: server xử lý ở nền (xoay EXIF, 1200px, WebP, bỏ GPS).
 * 4. Chưa có `url` thì hỏi GET /uploads/{id} tới khi có (thumbnail có thể còn đang làm, không cần chờ).
 */
@Injectable({ providedIn: 'root' })
export class UploadService {
  private readonly http = inject(HttpClient);

  /** Có thể chỉnh trong test để không phải chờ thật. */
  pollIntervalMs = 500;
  pollTimeoutMs = 30_000;

  /** Nén ở client (WebP, cạnh dài tối đa `maxSize`) rồi upload; trả URL công khai. */
  async uploadFile(
    file: File,
    maxSize: number,
    onProgress?: (percent: number) => void,
    meta: UploadMeta = {},
  ): Promise<UploadResult & { url: string }> {
    const blob = await fileToCompressedBlob(file, { maxSize });
    const name = meta.name?.trim() || file.name.replace(/\.[^.]+$/, '');
    const result = await this.uploadImage(blob, onProgress, { ...meta, name });
    if (!result.url) throw new Error('Server không trả về ảnh.');
    return { ...result, url: result.url };
  }

  async uploadImage(file: Blob, onProgress?: (percent: number) => void, meta: UploadMeta = {}): Promise<UploadResult> {
    const direct = await firstValueFrom(
      this.http.post<DirectUpload>(`${API_BASE}/uploads/direct`, {
        contentType: file.type,
        sizeBytes: file.size,
        ...(meta.purpose ? { purpose: meta.purpose } : {}),
        ...(meta.name ? { name: meta.name.slice(0, 200) } : {}),
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

    const completed = await firstValueFrom(
      this.http.post<UploadResult>(`${API_BASE}/uploads/${direct.id}/complete`, {}),
    );
    return isUsable(completed) ? completed : this.waitUntilProcessed(direct.id);
  }

  private async waitUntilProcessed(id: string): Promise<UploadResult> {
    const deadline = Date.now() + this.pollTimeoutMs;
    for (;;) {
      const upload = await firstValueFrom(this.http.get<UploadResult>(`${API_BASE}/uploads/${id}`));
      if (isUsable(upload)) return upload;
      if (upload.status === 'FAILED')
        throw new Error('File này không phải ảnh JPG, PNG hoặc WebP hợp lệ.');
      if (Date.now() > deadline) throw new Error('Server xử lý ảnh quá lâu, thử lại sau.');
      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }
  }
}

/** Ảnh đã dùng được: có URL công khai (thumbnail có thể vẫn đang sinh ở nền). */
function isUsable(upload: UploadResult): boolean {
  return !!upload.url && (upload.status === 'READY' || upload.status === 'THUMB_PENDING');
}
