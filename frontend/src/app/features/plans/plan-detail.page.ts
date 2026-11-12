import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { errorCode, problemOf } from '../../core/api/api';
import { AuthService } from '../../core/auth/auth.service';
import { DistrictOption } from '../../core/models/catalog.model';
import {
  directionsUrl,
  distanceText,
  Plan,
  PLAN_BUDGETS,
  PLAN_STATUSES,
  planStatusMeta,
  PlanStatus,
  PlanStop,
  STOP_WARNINGS,
  StopKind,
  stopCategoryLabel,
  stopIcon,
  StopWarning,
} from '../../core/models/plan.model';
import { thumbOf } from '../../core/models/place.model';
import { Vibe, vibeMeta, VIBES } from '../../core/models/vibe.model';
import { CatalogService } from '../../core/services/catalog.service';
import { DataBootstrapService } from '../../core/services/data-bootstrap.service';
import { GirlfriendService } from '../../core/services/girlfriend.service';
import { MatchInboxService } from '../../core/services/match-inbox.service';
import { PlanService } from '../../core/services/plan.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { ModalComponent } from '../../shared/ui/modal.component';
import { PlanMapComponent } from './plan-map.component';
import { StopPickerComponent } from './stop-picker.component';

const INPUT = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500';
const DURATIONS = [30, 45, 60, 75, 90, 120, 150, 180, 240];

/**
 * Một plan: dòng thời gian các điểm (giờ tới / rời tự tính, quãng đường, cảnh báo), thêm / đổi thứ tự / Đổi /
 * xoá điểm, bản đồ, rủ đi qua tin nhắn, sau buổi hẹn chấm điểm và ghi kỷ niệm. Plan người khác rủ: chỉ xem.
 */
@Component({
  selector: 'app-plan-detail-page',
  imports: [RouterLink, IconComponent, ModalComponent, ConfirmDialogComponent, StopPickerComponent, PlanMapComponent],
  templateUrl: './plan-detail.page.html',
})
export class PlanDetailPage implements OnInit {
  protected readonly thumbOf = thumbOf;
  protected readonly linkOpen = signal(false);
  private readonly api = inject(PlanService);
  private readonly catalog = inject(CatalogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly bootstrap = inject(DataBootstrapService);
  private readonly inbox = inject(MatchInboxService);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id')!;

  protected readonly canEdit = inject(AuthService).canEdit;
  protected readonly girlfriends = inject(GirlfriendService).items;
  protected readonly matches = this.inbox.matches;

  protected readonly input = INPUT;
  protected readonly statuses = PLAN_STATUSES;
  protected readonly budgets = PLAN_BUDGETS;
  protected readonly vibes = VIBES;

  protected readonly plan = signal<Plan | null>(null);
  protected readonly gone = signal(false);
  protected readonly districts = signal<DistrictOption[]>([]);
  protected readonly busy = signal(false);
  protected readonly pickerOpen = signal(false);
  protected readonly shareOpen = signal(false);
  protected readonly editOpen = signal(false);
  protected readonly confirmDelete = signal(false);
  protected readonly girlfriendId = signal('');
  protected readonly form = signal({
    title: '',
    date: null as string | null,
    startTime: '18:00',
    district: null as string | null,
    note: '',
    vibe: null as Vibe | null,
    budget: null as number | null,
    rainy: false,
  });

  protected readonly inPlan = computed(() => this.plan()?.stops.map((s) => s.refId) ?? []);
  protected readonly directions = computed(() => directionsUrl(this.plan()?.stops ?? []));
  protected readonly hasCoordinates = computed(() => (this.plan()?.stops ?? []).some((s) => s.lat !== null && s.lng !== null));

  async ngOnInit(): Promise<void> {
    void this.catalog.districts().then((d) => this.districts.set(d));
    try {
      this.plan.set(await this.api.get(this.id));
    } catch (err) {
      if (errorCode(err) === 'NOT_FOUND') this.gone.set(true);
    }
  }

  // ---- Hiển thị ----

  protected statusMeta(s: PlanStatus) {
    return planStatusMeta(s);
  }

  protected icon(category: string) {
    return stopIcon(category);
  }

  protected category(category: string) {
    return stopCategoryLabel(category);
  }

  protected distance(m: number) {
    return distanceText(m);
  }

  protected vibeIcon(v: Vibe) {
    return vibeMeta(v).icon;
  }

  protected vibeLabel(v: Vibe) {
    return vibeMeta(v).label;
  }

  protected warningMeta(w: StopWarning) {
    return STOP_WARNINGS[w];
  }

  protected warningClass(w: StopWarning): string {
    const tone = STOP_WARNINGS[w].tone;
    return tone === 'danger' ? 'bg-rose-50 text-rose-700' : tone === 'warn' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600';
  }

  protected durationsFor(s: PlanStop): number[] {
    return DURATIONS.includes(s.durationMin) ? DURATIONS : [...DURATIONS, s.durationMin].sort((a, b) => a - b);
  }

  protected dateText(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  protected budgetIndex(budget: number | null): number {
    return Math.max(0, this.budgets.findIndex((b) => b.value === budget));
  }

  // ---- Điểm dừng ----

  protected async addStop(e: { kind: StopKind; refId: string }): Promise<void> {
    await this.run(() => this.api.addStop(this.id, e.kind, e.refId));
    this.toast.success('Đã thêm vào plan.');
  }

  protected setDuration(s: PlanStop, durationMin: number): Promise<void> {
    return this.run(() => this.api.updateStop(this.id, s.id, { durationMin }));
  }

  protected setNote(s: PlanStop, note: string): Promise<void> {
    return this.run(() => this.api.updateStop(this.id, s.id, { note }));
  }

  protected rate(s: PlanStop, rating: number): Promise<void> {
    return this.run(() => this.api.updateStop(this.id, s.id, { rating }));
  }

  protected setMemory(s: PlanStop, memory: string): Promise<void> {
    return this.run(() => this.api.updateStop(this.id, s.id, { memory }));
  }

  protected removeStop(s: PlanStop): Promise<void> {
    return this.run(() => this.api.removeStop(this.id, s.id));
  }

  protected move(i: number, delta: -1 | 1): Promise<void> {
    const ids = this.plan()!.stops.map((s) => s.id);
    [ids[i], ids[i + delta]] = [ids[i + delta], ids[i]];
    return this.run(() => this.api.reorder(this.id, ids));
  }

  protected async swap(s: PlanStop): Promise<void> {
    try {
      await this.run(() => this.api.swap(this.id, s.id));
    } catch (err) {
      if (errorCode(err) === 'NO_ALTERNATIVE') this.toast.show(`Không còn ${stopCategoryLabel(s.category).toLowerCase()} nào khác phù hợp để đổi.`, 'info');
    }
  }

  // ---- Plan ----

  protected openEdit(): void {
    const p = this.plan()!;
    this.form.set({
      title: p.title,
      date: p.date,
      startTime: p.startTime,
      district: p.district,
      note: p.note,
      vibe: p.vibe,
      budget: p.budget,
      rainy: p.rainy,
    });
    this.editOpen.set(true);
  }

  protected patchForm(patch: Partial<ReturnType<typeof this.form>>): void {
    this.form.update((f) => ({ ...f, ...patch }));
  }

  protected async saveEdit(): Promise<void> {
    const p = this.plan()!;
    const f = this.form();
    try {
      await this.run(() => this.api.update(this.id, { ...f, title: f.title.trim(), version: p.version }));
      this.editOpen.set(false);
    } catch (err) {
      if (errorCode(err) === 'VERSION_CONFLICT') {
        const current = problemOf(err)?.current as Plan | undefined;
        if (current) this.plan.set(current);
        this.toast.show('Plan vừa được sửa ở nơi khác, đã tải bản mới nhất. Hãy sửa lại.', 'info');
        this.editOpen.set(false);
      }
    }
  }

  protected setStatus(status: PlanStatus): Promise<void> {
    return this.run(() => this.api.setStatus(this.id, status));
  }

  protected async setPlanMemory(memory: string): Promise<void> {
    const p = this.plan()!;
    await this.run(() =>
      this.api.update(this.id, {
        title: p.title,
        date: p.date,
        startTime: p.startTime,
        district: p.district,
        note: p.note,
        memory,
        vibe: p.vibe,
        budget: p.budget,
        rainy: p.rainy,
        version: p.version,
      }),
    );
  }

  protected async remove(): Promise<void> {
    this.confirmDelete.set(false);
    await this.api.remove(this.id);
    this.toast.success('Đã xoá plan.');
    await this.router.navigate(['/plans']);
  }

  protected async share(matchId: string, name: string): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.api.share(this.id, matchId);
      this.shareOpen.set(false);
      this.toast.success(`Đã rủ ${name} đi theo plan này.`);
    } finally {
      this.busy.set(false);
    }
  }

  protected async copy(): Promise<void> {
    const copy = await this.api.copy(this.id);
    this.toast.success('Đã lưu thành plan của bạn.');
    await this.router.navigate(['/plans', copy.id]);
  }

  protected async saveToGirlfriend(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const r = await this.api.saveToGirlfriend(this.id, this.girlfriendId());
      await this.bootstrap.loadAll(); // My place và quán đã đi cùng vừa thay đổi
      this.toast.success(
        `Đã lưu ${r.linked} quán vào Người yêu.` + (r.skipped ? ` ${r.skipped} chỗ chơi không lưu được (Người yêu chỉ gắn quán).` : ''),
      );
    } finally {
      this.busy.set(false);
    }
  }

  protected publicUrl(token: string): string {
    return `${location.origin}/p/${token}`;
  }

  protected async createLink(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const { token } = await this.api.publicLink(this.id);
      this.plan.update((p) => (p ? { ...p, shareToken: token } : p));
      await this.copyLink(token);
    } finally {
      this.busy.set(false);
    }
  }

  protected async copyLink(token: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.publicUrl(token));
      this.toast.success('Đã sao chép link.');
    } catch {
      this.toast.show('Không sao chép tự động được, hãy chọn link và sao chép.', 'info');
    }
  }

  protected async revokeLink(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.api.revokePublicLink(this.id);
      this.plan.update((p) => (p ? { ...p, shareToken: null } : p));
      this.toast.success('Đã tắt link. Link cũ không mở được nữa.');
    } finally {
      this.busy.set(false);
    }
  }

  /** Gọi API trả về plan mới rồi cập nhật trang */
  private async run(call: () => Promise<Plan>): Promise<void> {
    this.busy.set(true);
    try {
      this.plan.set(await call());
    } finally {
      this.busy.set(false);
    }
  }
}
