import { Component, input } from '@angular/core';
import { distanceText, PlanStop, STOP_WARNINGS, stopCategoryLabel, stopIcon, StopWarning } from '../../core/models/plan.model';
import { IconComponent } from '../../shared/ui/icon.component';

/** Dòng thời gian chỉ đọc của một plan (xem thử Autoplan, plan công khai). */
@Component({
  selector: 'app-plan-timeline',
  imports: [IconComponent],
  template: `
    <ol class="flex flex-col">
      @for (s of stops(); track s.id; let i = $index) {
        @if (i > 0) {
          <li class="ml-[34px] flex items-center gap-2 border-l-2 border-dashed border-brand-200 py-2 pl-6 text-xs text-slate-500">
            <app-icon [name]="s.travelMode === 'walk' ? 'user' : 'navigate'" [size]="14" />
            @if (s.distanceFromPrevM !== null) {
              {{ distance(s.distanceFromPrevM) }} · {{ s.travelFromPrevMin }} phút {{ s.travelMode === 'walk' ? 'đi bộ' : 'xe máy' }}
            } @else {
              Chưa rõ khoảng cách · ước {{ s.travelFromPrevMin }} phút
            }
          </li>
        }
        <li class="flex gap-3">
          <div class="flex w-[70px] shrink-0 flex-col items-center pt-3 text-center">
            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{{ i + 1 }}</span>
            <span class="mt-1 text-sm font-semibold text-slate-900">{{ s.arrival }}</span>
            <span class="text-xs text-slate-400">đến {{ s.departure }}</span>
          </div>
          <div class="min-w-0 flex-1 rounded-2xl border border-brand-100 bg-white p-3 sm:p-4">
            <div class="flex gap-3">
              <div class="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-brand-50 sm:h-20 sm:w-20">
                @if (s.imageUrl) {
                  <img [src]="s.imageUrl" alt="" class="h-full w-full object-cover" loading="lazy" />
                } @else {
                  <div class="flex h-full items-center justify-center text-brand-400"><app-icon [name]="icon(s.category)" [size]="24" /></div>
                }
              </div>
              <div class="min-w-0 flex-1">
                <p class="flex items-center gap-1.5 text-xs font-medium text-brand-700"><app-icon [name]="icon(s.category)" [size]="13" />{{ category(s.category) }} · {{ s.districtLabel }}</p>
                <h3 class="truncate text-base font-bold text-slate-900">{{ s.name }}</h3>
                <p class="truncate text-xs text-slate-500">{{ s.address || 'Chưa có địa chỉ' }}@if (s.openTime) { · mở {{ s.openTime }}–{{ s.closeTime }}}</p>
                @if (s.warnings.length) {
                  <div class="mt-1.5 flex flex-wrap gap-1.5">
                    @for (w of s.warnings; track w) {
                      <span class="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium" [class]="warningClass(w)">
                        <app-icon [name]="warningMeta(w).tone === 'info' ? 'info' : 'alert'" [size]="12" />{{ warningMeta(w).label }}
                      </span>
                    }
                  </div>
                }
                @if (s.note) {
                  <p class="mt-1.5 text-xs text-slate-600">{{ s.note }}</p>
                }
              </div>
            </div>
          </div>
        </li>
      }
    </ol>
  `,
})
export class PlanTimelineComponent {
  readonly stops = input.required<PlanStop[]>();

  protected icon(category: string) {
    return stopIcon(category);
  }

  protected category(category: string) {
    return stopCategoryLabel(category);
  }

  protected distance(m: number) {
    return distanceText(m);
  }

  protected warningMeta(w: StopWarning) {
    return STOP_WARNINGS[w];
  }

  protected warningClass(w: StopWarning): string {
    const tone = STOP_WARNINGS[w].tone;
    return tone === 'danger' ? 'bg-rose-50 text-rose-700' : tone === 'warn' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600';
  }
}
