import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from '../api/api';
import { SILENT_CODES } from '../api/http-context';
import {
  Candidate,
  DatingSettings,
  DatingSettingsRequest,
  Match,
  SwipeResult,
} from '../models/dating.model';

/** "Tìm đối tượng" của người đang đăng nhập. */
@Injectable({ providedIn: 'root' })
export class DatingService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE}/dating`;

  settings(): Promise<DatingSettings> {
    return firstValueFrom(this.http.get<DatingSettings>(`${this.base}/settings`));
  }

  saveSettings(req: DatingSettingsRequest): Promise<DatingSettings> {
    return firstValueFrom(this.http.put<DatingSettings>(`${this.base}/settings`, req));
  }

  deck(): Promise<Candidate[]> {
    return firstValueFrom(this.http.get<Candidate[]>(`${this.base}/deck`));
  }

  /** ALREADY_SWIPED (quẹt ở tab khác) do trang tự bỏ qua, không hiện toast. */
  swipe(targetId: string, liked: boolean): Promise<SwipeResult> {
    return firstValueFrom(
      this.http.post<SwipeResult>(
        `${this.base}/swipes`,
        { targetId, liked },
        { context: new HttpContext().set(SILENT_CODES, ['ALREADY_SWIPED']) },
      ),
    );
  }

  /** NOT_FOUND (không còn lượt để hoàn tác) do trang tự báo. */
  undo(): Promise<{ restored: Candidate }> {
    return firstValueFrom(
      this.http.delete<{ restored: Candidate }>(`${this.base}/swipes/last`, {
        context: new HttpContext().set(SILENT_CODES, ['NOT_FOUND']),
      }),
    );
  }

  matches(): Promise<Match[]> {
    return firstValueFrom(this.http.get<Match[]>(`${this.base}/matches`));
  }
}
