import { HttpClient, HttpEvent } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from '../api/api';

export interface UploadResult {
  id: string;
  url: string;
  thumbUrl: string | null;
  width: number;
  height: number;
  sizeBytes: number;
  status: 'READY' | 'THUMB_PENDING' | 'FAILED';
}

@Injectable({ providedIn: 'root' })
export class UploadService {
  private readonly http = inject(HttpClient);

  /** Trả về luồng sự kiện để hiện % tiến trình upload. */
  uploadImage(file: Blob, filename: string): Observable<HttpEvent<UploadResult>> {
    const form = new FormData();
    form.append('file', file, filename);
    return this.http.post<UploadResult>(`${API_BASE}/uploads/image`, form, {
      reportProgress: true,
      observe: 'events',
    });
  }
}
