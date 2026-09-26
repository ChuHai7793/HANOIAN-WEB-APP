import { Component, input, model } from '@angular/core';

@Component({
  selector: 'app-rating-stars',
  template: `
    <div class="flex items-center gap-0.5">
      @for (star of stars; track star) {
        @if (editable()) {
          <button
            type="button"
            class="transition hover:scale-110"
            [class]="sizeClass()"
            [class.text-amber-400]="star <= value()"
            [class.text-slate-300]="star > value()"
            (click)="value.set(star)"
            [attr.aria-label]="star + ' sao'"
          >
            ★
          </button>
        } @else {
          <span
            [class]="sizeClass()"
            [class.text-amber-400]="star <= value()"
            [class.text-slate-300]="star > value()"
            >★</span
          >
        }
      }
      @if (showValue()) {
        <span class="ml-1.5 text-sm font-medium text-slate-500">{{ value() }}/5</span>
      }
    </div>
  `,
})
export class RatingStarsComponent {
  readonly value = model(0);
  readonly editable = input(false);
  readonly showValue = input(false);
  readonly size = input<'sm' | 'md' | 'lg'>('sm');

  protected readonly stars = [1, 2, 3, 4, 5];

  protected sizeClass(): string {
    switch (this.size()) {
      case 'lg':
        return 'text-2xl leading-none';
      case 'md':
        return 'text-xl leading-none';
      default:
        return 'text-base leading-none';
    }
  }
}
