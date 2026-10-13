import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { directionsUrl, distanceText } from '../../core/models/plan.model';
import { vibeMeta } from '../../core/models/vibe.model';
import { IconComponent } from '../../shared/ui/icon.component';
import { AutoplanDialogComponent } from './autoplan-dialog.component';
import { AutoplanFlowService } from './autoplan-flow.service';
import { PlanMapComponent } from './plan-map.component';
import { PlanTimelineComponent } from './plan-timeline.component';

/**
 * Xem thử Autoplan (khách chưa đăng nhập cũng dùng được): lịch trình, bản đồ, "Tạo lại", "Lưu plan này"
 * (khách: đăng ký rồi quay lại đây với ?save=1 để lưu luôn).
 */
@Component({
  selector: 'app-autoplan-preview-page',
  imports: [RouterLink, IconComponent, AutoplanDialogComponent, PlanTimelineComponent, PlanMapComponent],
  template: `
    <div class="mx-auto flex max-w-4xl flex-col gap-4 px-4 pb-10 pt-4 sm:px-6 lg:pt-5">
      @if (draft(); as d) {
        <header class="flex flex-wrap items-start justify-between gap-3">
          <div class="flex flex-col gap-1.5">
            <p class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-600"><app-icon name="shuffle" [size]="14" />Autoplan gợi ý</p>
            <h1 class="text-[22px] font-extrabold tracking-tight text-slate-900">{{ d.plan.title }}</h1>
            <p class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
              <span class="flex items-center gap-1"><app-icon name="clock" [size]="15" />{{ d.plan.startTime }}–{{ d.plan.endTime }}</span>
              @if (d.plan.districtLabel) {
                <span class="flex items-center gap-1"><app-icon name="pin" [size]="15" />{{ d.plan.districtLabel }}</span>
              }
              @if (d.plan.totalDistanceM) {
                <span class="flex items-center gap-1"><app-icon name="route" [size]="15" />{{ distance(d.plan.totalDistanceM) }}</span>
              }
              @if (d.plan.vibe) {
                <span class="flex items-center gap-1 text-brand-700"><app-icon [name]="vibeIcon()" [size]="15" />{{ vibeLabel() }}</span>
              }
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="flex min-h-10 items-center gap-1.5 rounded-xl border border-brand-200 bg-white px-3 text-sm text-slate-700 hover:bg-brand-50 disabled:opacity-50" [disabled]="busy()" (click)="regenerate()">
              <app-icon name="refresh" [size]="16" />Tạo lại
            </button>
            <button type="button" class="flex min-h-10 items-center gap-1.5 rounded-xl border border-brand-200 bg-white px-3 text-sm text-slate-700 hover:bg-brand-50" (click)="dialogOpen.set(true)">
              <app-icon name="filter" [size]="16" />Đổi tuỳ chọn
            </button>
            <button type="button" class="flex min-h-10 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50" [disabled]="busy()" (click)="save()">
              <app-icon name="bookmark" [size]="16" />Lưu plan này
            </button>
          </div>
        </header>

        @if (!loggedIn()) {
          <p class="rounded-xl bg-brand-50 px-4 py-2.5 text-sm text-brand-800">
            Đây là bản xem thử. <button type="button" class="font-semibold underline" (click)="save()">Tạo tài khoản miễn phí</button> để lưu, chỉnh từng điểm và rủ người ấy đi cùng.
          </p>
        }
        @for (n of d.notes; track n) {
          <p class="flex items-start gap-1.5 text-xs text-slate-500"><span class="mt-0.5"><app-icon name="info" [size]="13" /></span>{{ n }}</p>
        }

        <app-plan-timeline [stops]="d.plan.stops" />
        @if (hasCoordinates()) {
          <app-plan-map [stops]="d.plan.stops" />
        }
        @if (directions(); as url) {
          <a [href]="url" target="_blank" rel="noopener" class="flex w-fit items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
            <app-icon name="navigate" [size]="15" />Chỉ đường qua mọi điểm (Google Maps)
          </a>
        }
      } @else {
        <div class="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-brand-200 bg-white px-6 py-14 text-center">
          <span class="text-brand-600"><app-icon name="shuffle" [size]="36" /></span>
          <h1 class="text-lg font-semibold text-slate-900">Autoplan: buổi hẹn trong 10 giây</h1>
          <p class="max-w-md text-sm text-slate-500">Chọn khu vực, app dựng sẵn lịch trình gồm chỗ chơi, quán ăn, cafe gần nhau, đúng giờ mở cửa.</p>
          <button type="button" class="mt-2 flex min-h-10 items-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700" (click)="dialogOpen.set(true)">
            <app-icon name="shuffle" [size]="18" />Thử Autoplan
          </button>
          <a routerLink="/explore" class="text-sm text-slate-500 hover:text-slate-800">Hoặc tự xem quán</a>
        </div>
      }
    </div>

    @if (dialogOpen()) {
      <app-autoplan-dialog [initial]="draft()?.request ?? null" (closed)="dialogOpen.set(false)" />
    }
  `,
})
export class AutoplanPreviewPage implements OnInit {
  private readonly flow = inject(AutoplanFlowService);
  protected readonly loggedIn = inject(AuthService).isLoggedIn;
  /** ?save=1: vừa đăng ký / đăng nhập xong để lưu bản thử */
  readonly save_ = input<string | undefined>(undefined, { alias: 'save' });

  protected readonly draft = this.flow.draft;
  protected readonly busy = signal(false);
  protected readonly dialogOpen = signal(false);
  protected readonly directions = computed(() => directionsUrl(this.draft()?.plan.stops ?? []));
  protected readonly hasCoordinates = computed(() => (this.draft()?.plan.stops ?? []).some((s) => s.lat !== null && s.lng !== null));
  protected readonly vibeIcon = computed(() => vibeMeta(this.draft()!.plan.vibe!).icon);
  protected readonly vibeLabel = computed(() => vibeMeta(this.draft()!.plan.vibe!).label);

  ngOnInit(): void {
    if (this.save_() && this.loggedIn() && this.draft()) void this.save();
    if (!this.draft()) this.dialogOpen.set(true);
  }

  protected distance(m: number) {
    return distanceText(m);
  }

  protected async regenerate(): Promise<void> {
    const d = this.draft();
    if (!d || this.busy()) return;
    this.busy.set(true);
    try {
      await this.flow.preview(d.request);
    } finally {
      this.busy.set(false);
    }
  }

  protected async save(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.flow.saveDraft();
    } finally {
      this.busy.set(false);
    }
  }
}
