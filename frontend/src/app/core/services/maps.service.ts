import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from '../api/api';
import { SILENT_ERRORS } from '../api/http-context';

export interface ResolvedMapsLink {
  /** null khi link hợp lệ nhưng trang đích không chứa toạ độ */
  lat: number | null;
  lng: number | null;
  resolvedUrl: string;
}

@Injectable({ providedIn: 'root' })
export class MapsService {
  private readonly http = inject(HttpClient);

  /**
   * Nhờ server giải link rút gọn (maps.app.goo.gl) thành toạ độ. Lỗi được form hiện ngay dưới ô
   * nhập nên không cần toast chung.
   */
  resolve(url: string): Promise<ResolvedMapsLink> {
    return firstValueFrom(
      this.http.get<ResolvedMapsLink>(`${API_BASE}/maps/resolve`, {
        params: { url },
        context: new HttpContext().set(SILENT_ERRORS, true),
      }),
    );
  }
}
