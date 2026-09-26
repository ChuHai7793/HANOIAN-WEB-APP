import { Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  template: `
    <div class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <div class="mb-4 text-5xl">{{ icon() }}</div>
      <h3 class="text-base font-semibold text-slate-800">{{ title() }}</h3>
      @if (description()) {
        <p class="mt-1 max-w-sm text-sm text-slate-500">{{ description() }}</p>
      }
      <div class="mt-5 empty:hidden">
        <ng-content />
      </div>
    </div>
  `,
})
export class EmptyStateComponent {
  readonly icon = input('📭');
  readonly title = input('Chưa có dữ liệu');
  readonly description = input('');
}
