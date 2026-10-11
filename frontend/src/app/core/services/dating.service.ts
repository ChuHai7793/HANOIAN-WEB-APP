import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from '../api/api';
import { SILENT_CODES } from '../api/http-context';
import {
  Candidate,
  DatingActivity,
  DatingReport,
  DatingSettings,
  DatingSettingsRequest,
  DatingStats,
  DatingUserRow,
  Match,
  ReportReason,
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

  unmatch(matchId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/matches/${matchId}`));
  }

  block(userId: string): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.base}/blocks`, { userId }));
  }

  report(userId: string, reason: ReportReason, note: string, block: boolean): Promise<void> {
    return firstValueFrom(this.http.post<void>(`${this.base}/reports`, { userId, reason, note, block }));
  }

  // ---- Quản trị (chỉ admin) ----

  adminStats(): Promise<DatingStats> {
    return firstValueFrom(this.http.get<DatingStats>(`${API_BASE}/admin/dating/stats`));
  }

  adminReports(status: 'OPEN' | 'RESOLVED'): Promise<DatingReport[]> {
    return firstValueFrom(this.http.get<DatingReport[]>(`${API_BASE}/admin/dating/reports`, { params: { status } }));
  }

  resolveReport(id: string, status: 'OPEN' | 'RESOLVED'): Promise<void> {
    return firstValueFrom(this.http.put<void>(`${API_BASE}/admin/dating/reports/${id}`, { status }));
  }

  adminUsers(): Promise<DatingUserRow[]> {
    return firstValueFrom(this.http.get<DatingUserRow[]>(`${API_BASE}/admin/dating/users`));
  }

  adminActivity(userId: string): Promise<DatingActivity> {
    return firstValueFrom(this.http.get<DatingActivity>(`${API_BASE}/admin/dating/users/${userId}`));
  }

  ban(userId: string, banned: boolean): Promise<void> {
    return firstValueFrom(this.http.put<void>(`${API_BASE}/admin/dating/users/${userId}/ban`, { banned }));
  }
}
