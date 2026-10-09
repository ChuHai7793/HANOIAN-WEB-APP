import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from '../api/api';
import { SILENT_CODES } from '../api/http-context';
import { AdminUser, Profile, ProfileRequest } from '../models/profile.model';

/**
 * Hồ sơ của chính người đang đăng nhập (guest cũng sửa được) và danh sách người dùng cho admin.
 * VERSION_CONFLICT do nơi gọi tự xử lý (nạp lại bản mới nhất), nên không hiện toast chung.
 */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);

  get(): Promise<Profile> {
    return firstValueFrom(this.http.get<Profile>(`${API_BASE}/me/profile`));
  }

  save(profile: ProfileRequest): Promise<Profile> {
    return firstValueFrom(
      this.http.put<Profile>(`${API_BASE}/me/profile`, profile, {
        context: new HttpContext().set(SILENT_CODES, ['VERSION_CONFLICT']),
      }),
    );
  }

  adminUsers(): Promise<AdminUser[]> {
    return firstValueFrom(this.http.get<AdminUser[]>(`${API_BASE}/admin/users`));
  }
}
