import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { LoginGate } from '../../core/auth/login-gate.service';
import { AutoplanRequest, Plan } from '../../core/models/plan.model';
import { PlanService } from '../../core/services/plan.service';
import { ToastService } from '../../core/services/toast.service';

const DRAFT_KEY = 'gfm.autoplanDraft';

export interface AutoplanDraft {
  request: AutoplanRequest;
  plan: Plan;
  notes: string[];
}

/**
 * Autoplan cho mọi người: đã đăng nhập thì tạo plan ngay; khách thì dựng thử (không lưu), xem ở /autoplan,
 * đăng ký xong quay lại lưu. Bản thử giữ trong sessionStorage để không mất khi đi đăng ký.
 */
@Injectable({ providedIn: 'root' })
export class AutoplanFlowService {
  private readonly api = inject(PlanService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly gate = inject(LoginGate);

  readonly draft = signal<AutoplanDraft | null>(readDraft());

  async run(request: AutoplanRequest): Promise<void> {
    if (this.auth.isLoggedIn()) {
      const { plan, notes } = await this.api.autoplan(request);
      for (const n of notes) this.toast.show(n, 'info', 7000);
      await this.router.navigate(['/plans', plan.id]);
      return;
    }
    await this.preview(request);
    await this.router.navigate(['/autoplan']);
  }

  /** Dựng thử (khách), giữ lại để xem / lưu sau */
  async preview(request: AutoplanRequest): Promise<void> {
    const { plan, notes } = await this.api.preview(request);
    this.setDraft({ request, plan, notes });
  }

  /** Lưu bản thử thành plan của mình (khách: hiện popup đăng nhập; đăng ký thì quay lại /autoplan?save=1). */
  async saveDraft(): Promise<void> {
    const d = this.draft();
    if (!d || !this.gate.check('lưu plan này', () => this.saveDraft(), '/autoplan?save=1')) return;
    const p = d.plan;
    const created = await this.api.create({
      title: p.title,
      date: p.date,
      startTime: p.startTime,
      district: p.district,
      note: '',
      vibe: p.vibe,
      budget: p.budget,
      rainy: p.rainy,
    });
    for (const s of p.stops) await this.api.addStop(created.id, s.kind, s.refId);
    this.setDraft(null);
    this.toast.success('Đã lưu plan.');
    await this.router.navigate(['/plans', created.id]);
  }

  private setDraft(d: AutoplanDraft | null): void {
    this.draft.set(d);
    try {
      if (d) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
      else sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // trình duyệt chặn lưu trữ: bản thử chỉ còn trong bộ nhớ
    }
  }
}

function readDraft(): AutoplanDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as AutoplanDraft) : null;
  } catch {
    return null;
  }
}
