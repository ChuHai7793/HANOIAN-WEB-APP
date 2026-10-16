import { Component, HostListener, input, output } from '@angular/core';
import { ActiveFilter, ChoiceOption } from '../../core/models/filters.model';
import { IconComponent, IconName } from './icon.component';

/**
 * Bảng "Bộ lọc" chi tiết (Khám phá quán, Tìm chỗ chơi, My place). Máy tính: trượt từ bên phải; điện thoại:
 * trượt từ dưới lên. Bộ lọc áp dụng ngay khi bấm (danh sách phía sau tự tải lại); nút cuối chỉ đóng bảng và
 * cho biết số kết quả hiện có.
 */
@Component({
  selector: 'app-filter-sheet',
  imports: [IconComponent],
  template: `
    <div class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" (click)="closed.emit()"></div>
      <aside
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title()"
        class="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-2xl bg-white shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[420px] sm:rounded-none sm:rounded-l-2xl"
      >
        <header class="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 class="flex items-center gap-2 text-lg font-bold text-slate-900"><app-icon name="filter" [size]="18" />{{ title() }}</h2>
          <button type="button" class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Đóng" (click)="closed.emit()">
            <app-icon name="close" [size]="20" />
          </button>
        </header>
        <div class="scroll-thin flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-5">
          <ng-content />
        </div>
        <footer class="flex shrink-0 items-center gap-3 border-t border-slate-100 px-5 py-3">
          <button type="button" class="text-sm font-medium text-slate-500 hover:text-slate-800 disabled:opacity-40" [disabled]="!activeCount()" (click)="cleared.emit()">
            Xoá hết{{ activeCount() ? ' (' + activeCount() + ')' : '' }}
          </button>
          <button type="button" class="ml-auto min-h-11 rounded-xl bg-brand-600 px-6 text-sm font-semibold text-white hover:bg-brand-700" (click)="closed.emit()">
            {{ resultLabel() }}
          </button>
        </footer>
      </aside>
    </div>
  `,
})
export class FilterSheetComponent {
  readonly title = input('Bộ lọc');
  /** Nhãn nút cuối, vd. "Xem 12 quán" */
  readonly resultLabel = input.required<string>();
  readonly activeCount = input(0);
  readonly closed = output<void>();
  readonly cleared = output<void>();

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.closed.emit();
  }
}

/** Một nhóm trong bảng lọc: tiêu đề nhỏ + nội dung (nhóm chip, công tắc…) */
@Component({
  selector: 'app-filter-group',
  template: `
    <section>
      <h3 class="mb-2 text-sm font-semibold text-slate-800">
        {{ title() }}
        @if (hint()) {
          <span class="font-normal text-slate-400">· {{ hint() }}</span>
        }
      </h3>
      <ng-content />
    </section>
  `,
})
export class FilterGroupComponent {
  readonly title = input.required<string>();
  readonly hint = input('');
}

/** Nhóm chip chọn: trang cha quyết định chọn một hay nhiều (bấm lại chip đang chọn = bỏ chọn) */
@Component({
  selector: 'app-choice-chips',
  imports: [IconComponent],
  template: `
    <div class="flex flex-wrap gap-2">
      @for (o of options(); track o.value) {
        <button
          type="button"
          [attr.aria-pressed]="isOn(o.value)"
          class="inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] transition"
          [class]="isOn(o.value) ? 'border-brand-600 bg-brand-600 font-semibold text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50'"
          (click)="toggle.emit(o.value)"
        >
          @if (o.icon) {
            <app-icon [name]="o.icon" [size]="14" />
          }
          {{ o.label }}
        </button>
      }
    </div>
  `,
})
export class ChoiceChipsComponent {
  readonly options = input.required<ChoiceOption[]>();
  readonly selected = input<(string | number | null)[]>([]);
  readonly toggle = output<string | number>();

  protected isOn(value: string | number): boolean {
    return this.selected().includes(value);
  }
}

/** Công tắc bật / tắt trong bảng lọc (Đang mở cửa, Có wifi…) */
@Component({
  selector: 'app-filter-switch',
  imports: [IconComponent],
  template: `
    <button type="button" role="switch" [attr.aria-checked]="on()" class="flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm transition" [class]="on() ? 'border-brand-300 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'" (click)="toggle.emit()">
      <span class="text-brand-600"><app-icon [name]="icon()" [size]="17" /></span>
      <span class="flex-1 text-slate-700">{{ label() }}</span>
      <span class="relative h-5 w-9 shrink-0 rounded-full transition" [class]="on() ? 'bg-brand-600' : 'bg-slate-300'">
        <span class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all" [class]="on() ? 'left-[18px]' : 'left-0.5'"></span>
      </span>
    </button>
  `,
})
export class FilterSwitchComponent {
  readonly label = input.required<string>();
  readonly icon = input.required<IconName>();
  readonly on = input(false);
  readonly toggle = output<void>();
}

/** Bộ lọc đang bật: chip có dấu ✕ ngay trên danh sách, bấm để bỏ từng cái */
@Component({
  selector: 'app-active-filters',
  imports: [IconComponent],
  template: `
    @if (items().length) {
      <div class="flex flex-wrap items-center gap-2">
        @for (f of items(); track f.key) {
          <button type="button" class="inline-flex min-h-8 items-center gap-1 rounded-full bg-brand-100 py-1 pl-3 pr-2 text-[13px] font-medium text-brand-800 hover:bg-brand-200" [attr.aria-label]="'Bỏ lọc ' + f.label" (click)="remove.emit(f.key)">
            {{ f.label }}<app-icon name="close" [size]="13" [stroke]="2.4" />
          </button>
        }
        @if (items().length > 1) {
          <button type="button" class="text-[13px] font-medium text-slate-500 hover:text-slate-800 hover:underline" (click)="clear.emit()">Xoá hết</button>
        }
      </div>
    }
  `,
})
export class ActiveFiltersComponent {
  readonly items = input.required<ActiveFilter[]>();
  readonly remove = output<string>();
  readonly clear = output<void>();
}

/** Nút "Bộ lọc" trắng bo tròn trong banner, có số bộ lọc đang bật */
@Component({
  selector: 'app-filter-button',
  imports: [IconComponent],
  template: `
    <button type="button" class="flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-slate-700 shadow-lg shadow-brand-900/20 transition hover:bg-brand-50" (click)="open.emit()">
      <span class="text-brand-600"><app-icon name="filter" [size]="18" /></span>Bộ lọc
      @if (count()) {
        <span class="min-w-5 rounded-full bg-brand-600 px-1.5 text-center text-xs font-semibold leading-5 text-white">{{ count() }}</span>
      }
    </button>
  `,
})
export class FilterButtonComponent {
  readonly count = input(0);
  readonly open = output<void>();
}
