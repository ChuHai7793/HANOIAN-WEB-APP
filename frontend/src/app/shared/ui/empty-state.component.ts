import { Component, input } from '@angular/core';
import { IconComponent, IconName } from './icon.component';

@Component({
  selector: 'app-empty-state',
  imports: [IconComponent],
  template: `
    <div class="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-brand-300 bg-white px-6 py-16 text-center">
      <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
        <app-icon [name]="icon()" [size]="30" />
      </div>
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
  readonly icon = input<IconName>('inbox');
  readonly title = input('Chưa có dữ liệu');
  readonly description = input('');
}
