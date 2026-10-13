import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { errorCode } from '../../core/api/api';
import { AuthService } from '../../core/auth/auth.service';
import { LoginGate } from '../../core/auth/login-gate.service';
import { directionsUrl, distanceText, Plan } from '../../core/models/plan.model';
import { PlanService } from '../../core/services/plan.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { PlanMapComponent } from './plan-map.component';
import { PlanTimelineComponent } from './plan-timeline.component';

/**
 * Plan được chia sẻ bằng link công khai /p/<mã>: ai cũng xem được (kể cả khách). "Lưu về plan của tôi"
 * (khách: đăng ký rồi quay lại với ?copy=1 để chép luôn).
 */
@Component({
  selector: 'app-public-plan-page',
  imports: [RouterLink, IconComponent, PlanTimelineComponent, PlanMapComponent],
  template: `
    <div class="mx-auto flex max-w-4xl flex-col gap-4 px-4 pb-10 pt-4 sm:px-6 lg:pt-5">
      @if (gone()) {
        <div class="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          <p>Link này không còn (chủ plan đã tắt chia sẻ hoặc xoá plan).</p>
          <a routerLink="/autoplan" class="font-semibold text-brand-700 hover:underline">Tự dựng một plan với Autoplan</a>
        </div>
      } @else if (plan(); as p) {
        <header class="flex flex-wrap items-start justify-between gap-3">
          <div class="flex flex-col gap-1.5">
            <p class="text-xs text-slate-500">{{ p.ownerName }} chia sẻ plan hẹn hò</p>
            <h1 class="text-[22px] font-extrabold tracking-tight text-slate-900">{{ p.title }}</h1>
            <p class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
              @if (p.date) {
                <span class="flex items-center gap-1"><app-icon name="calendar" [size]="15" />{{ dateText(p.date) }}</span>
              }
              <span class="flex items-center gap-1"><app-icon name="clock" [size]="15" />{{ p.startTime }}–{{ p.endTime }}</span>
              @if (p.districtLabel) {
                <span class="flex items-center gap-1"><app-icon name="pin" [size]="15" />{{ p.districtLabel }}</span>
              }
              @if (p.totalDistanceM) {
                <span class="flex items-center gap-1"><app-icon name="route" [size]="15" />{{ distance(p.totalDistanceM) }}</span>
              }
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            @if (directions(); as url) {
              <a [href]="url" target="_blank" rel="noopener" class="flex min-h-10 items-center gap-1.5 rounded-xl border border-brand-200 bg-white px-3 text-sm text-slate-700 hover:bg-brand-50">
                <app-icon name="navigate" [size]="16" />Chỉ đường
              </a>
            }
            <button type="button" class="flex min-h-10 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50" [disabled]="busy()" (click)="copy()">
              <app-icon name="bookmark" [size]="16" />Lưu về plan của tôi
            </button>
          </div>
        </header>
        @if (p.note) {
          <p class="whitespace-pre-line text-sm text-slate-600">{{ p.note }}</p>
        }
        <app-plan-timeline [stops]="p.stops" />
        @if (hasCoordinates()) {
          <app-plan-map [stops]="p.stops" />
        }
        <div class="mt-2 flex flex-col items-center gap-2 rounded-2xl bg-brand-50 px-6 py-6 text-center">
          <p class="text-sm font-semibold text-slate-900">Muốn một buổi hẹn như vậy?</p>
          <p class="text-xs text-slate-600">Chọn khu vực, Autoplan dựng sẵn lịch trình trong 10 giây.</p>
          <a routerLink="/autoplan" class="mt-1 flex min-h-10 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
            <app-icon name="shuffle" [size]="16" />Thử Autoplan
          </a>
        </div>
      } @else {
        <p class="text-sm text-slate-500">Đang tải…</p>
      }
    </div>
  `,
})
export class PublicPlanPage implements OnInit {
  private readonly api = inject(PlanService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly gate = inject(LoginGate);
  private readonly loggedIn = inject(AuthService).isLoggedIn;

  readonly token = input.required<string>();
  /** ?copy=1: vừa đăng ký / đăng nhập xong để chép plan */
  readonly copyAfterLogin = input<string | undefined>(undefined, { alias: 'copy' });

  protected readonly plan = signal<Plan | null>(null);
  protected readonly gone = signal(false);
  protected readonly busy = signal(false);
  protected readonly directions = computed(() => directionsUrl(this.plan()?.stops ?? []));
  protected readonly hasCoordinates = computed(() => (this.plan()?.stops ?? []).some((s) => s.lat !== null && s.lng !== null));

  async ngOnInit(): Promise<void> {
    try {
      this.plan.set(await this.api.getPublic(this.token()));
      if (this.copyAfterLogin() && this.loggedIn()) await this.copy();
    } catch (err) {
      if (errorCode(err) === 'NOT_FOUND') this.gone.set(true);
    }
  }

  protected distance(m: number) {
    return distanceText(m);
  }

  protected dateText(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  protected async copy(): Promise<void> {
    if (this.busy() || !this.gate.check('lưu plan này', () => this.copy(), `/p/${this.token()}?copy=1`)) return;
    this.busy.set(true);
    try {
      const copy = await this.api.copyPublic(this.token());
      this.toast.success('Đã lưu thành plan của bạn.');
      await this.router.navigate(['/plans', copy.id]);
    } finally {
      this.busy.set(false);
    }
  }
}
