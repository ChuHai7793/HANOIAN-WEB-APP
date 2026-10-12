import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from '../api/api';
import { SILENT_CODES } from '../api/http-context';
import { ChatMessage } from '../models/dating.model';
import { AutoplanRequest, Plan, PlanRequest, PlanStatus, PlanSummary, StopKind } from '../models/plan.model';

/** "Plan": lịch trình buổi hẹn của người đang đăng nhập. */
@Injectable({ providedIn: 'root' })
export class PlanService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE}/plans`;

  list(): Promise<PlanSummary[]> {
    return firstValueFrom(this.http.get<PlanSummary[]>(this.base));
  }

  /** Plan không còn / không được xem: trang tự báo, không hiện toast chung */
  get(id: string): Promise<Plan> {
    return firstValueFrom(
      this.http.get<Plan>(`${this.base}/${id}`, { context: new HttpContext().set(SILENT_CODES, ['NOT_FOUND']) }),
    );
  }

  create(req: PlanRequest): Promise<Plan> {
    return firstValueFrom(this.http.post<Plan>(this.base, req));
  }

  update(id: string, req: PlanRequest): Promise<Plan> {
    return firstValueFrom(
      this.http.put<Plan>(`${this.base}/${id}`, req, { context: new HttpContext().set(SILENT_CODES, ['VERSION_CONFLICT']) }),
    );
  }

  setStatus(id: string, status: PlanStatus): Promise<Plan> {
    return firstValueFrom(this.http.put<Plan>(`${this.base}/${id}/status`, { status }));
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/${id}`));
  }

  autoplan(req: AutoplanRequest): Promise<{ plan: Plan; notes: string[] }> {
    return firstValueFrom(this.http.post<{ plan: Plan; notes: string[] }>(`${this.base}/autoplan`, req));
  }

  addStop(id: string, kind: StopKind, refId: string, position?: number): Promise<Plan> {
    return firstValueFrom(this.http.post<Plan>(`${this.base}/${id}/stops`, { kind, refId, position: position ?? null }));
  }

  updateStop(id: string, stopId: string, patch: Partial<{ durationMin: number; note: string; rating: number; memory: string }>): Promise<Plan> {
    return firstValueFrom(this.http.patch<Plan>(`${this.base}/${id}/stops/${stopId}`, patch));
  }

  removeStop(id: string, stopId: string): Promise<Plan> {
    return firstValueFrom(this.http.delete<Plan>(`${this.base}/${id}/stops/${stopId}`));
  }

  reorder(id: string, stopIds: string[]): Promise<Plan> {
    return firstValueFrom(this.http.put<Plan>(`${this.base}/${id}/stops/order`, { stopIds }));
  }

  /** Đổi sang phương án khác; hết phương án thì trang tự báo */
  swap(id: string, stopId: string): Promise<Plan> {
    return firstValueFrom(
      this.http.post<Plan>(`${this.base}/${id}/stops/${stopId}/swap`, {}, {
        context: new HttpContext().set(SILENT_CODES, ['NO_ALTERNATIVE']),
      }),
    );
  }

  share(id: string, matchId: string): Promise<ChatMessage> {
    return firstValueFrom(this.http.post<ChatMessage>(`${this.base}/${id}/share`, { matchId }));
  }

  copy(id: string): Promise<Plan> {
    return firstValueFrom(this.http.post<Plan>(`${this.base}/${id}/copy`, {}));
  }

  saveToGirlfriend(id: string, girlfriendId: string): Promise<{ linked: number; skipped: number }> {
    return firstValueFrom(
      this.http.post<{ linked: number; skipped: number }>(`${this.base}/${id}/save-to-girlfriend`, { girlfriendId }),
    );
  }
}
