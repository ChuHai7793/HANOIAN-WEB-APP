import { Component, computed, input } from '@angular/core';
import { Vibe, vibeMeta } from '../../core/models/vibe.model';

/** Nhãn kiểu hẹn trên thẻ quán / chỗ chơi (chỉ hiển thị). */
@Component({
  selector: 'app-vibe-tags',
  template: `
    @if (tags().length) {
      <div class="flex flex-wrap gap-1.5" aria-label="Kiểu hẹn phù hợp">
        @for (t of tags(); track t.value) {
          <span class="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">{{ t.icon }} {{ t.label }}</span>
        }
      </div>
    }
  `,
})
export class VibeTagsComponent {
  readonly vibes = input<Vibe[] | null | undefined>([]);

  protected readonly tags = computed(() => (this.vibes() ?? []).map((value) => ({ value, ...vibeMeta(value) })));
}
