import { Component, computed, inject, input, output, signal } from '@angular/core';
import { ModalComponent } from '../../shared/ui/modal.component';
import { RatingStarsComponent } from '../../shared/ui/rating-stars.component';
import { PlaceService } from '../../core/services/place.service';
import { PlaceLinkService } from '../../core/services/place-link.service';
import { PLACE_ICONS, PLACE_LABELS, PlaceType } from '../../core/models/place.model';
import { PlaceLink } from '../../core/models/place-link.model';
import { nowIso, todayIso } from '../../core/utils/id';

@Component({
  selector: 'app-link-place-dialog',
  imports: [ModalComponent, RatingStarsComponent],
  template: `
    <app-modal
      [title]="link() ? 'Sửa kỷ niệm' : heading()"
      [subtitle]="link() ? placeName() : 'Chọn quán rồi ghi lại cảm nhận của nàng'"
      width="max-w-xl"
      (dismiss)="cancel.emit()"
    >
      <div class="space-y-5">
        @if (!link()) {
          <div>
            <label class="mb-1.5 block text-sm font-medium text-slate-700">
              Chọn quán <span class="text-rose-500">*</span>
            </label>
            <input
              type="search"
              [value]="search()"
              (input)="search.set($any($event.target).value)"
              placeholder="Tìm quán theo tên…"
              class="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />

            @if (candidates().length === 0) {
              <p class="rounded-lg bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
                Không còn quán nào để gắn. Hãy thêm quán mới ở màn danh sách trước.
              </p>
            } @else {
              <div class="scroll-thin max-h-56 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 p-1.5">
                @for (p of candidates(); track p.id) {
                  <button
                    type="button"
                    class="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition"
                    [class]="
                      selectedId() === p.id ? 'bg-brand-50 ring-1 ring-brand-300' : 'hover:bg-slate-50'
                    "
                    (click)="selectedId.set(p.id)"
                  >
                    @if (p.imageUrl) {
                      <img [src]="p.imageUrl" [alt]="p.name" class="h-10 w-10 rounded-md object-cover" />
                    } @else {
                      <div class="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100">
                        {{ icon() }}
                      </div>
                    }
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-medium text-slate-800">{{ p.name }}</p>
                      <p class="truncate text-xs text-slate-500">{{ p.address }}</p>
                    </div>
                    @if (selectedId() === p.id) {
                      <span class="text-brand-600">✓</span>
                    }
                  </button>
                }
              </div>
            }
          </div>
        }

        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700">Nàng chấm mấy điểm?</label>
          <app-rating-stars
            [value]="herRating()"
            (valueChange)="herRating.set($event)"
            [editable]="true"
            [showValue]="true"
            size="lg"
          />
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700">Lần gần nhất đi</label>
          <input
            type="date"
            [value]="visitedAt()"
            (input)="visitedAt.set($any($event.target).value)"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700">Kỷ niệm</label>
          <textarea
            rows="3"
            [value]="memory()"
            (input)="memory.set($any($event.target).value)"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            placeholder="Hôm đó có chuyện gì đáng nhớ?"
          ></textarea>
        </div>
      </div>

      <div modalFooter class="contents">
        <button
          type="button"
          class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          (click)="cancel.emit()"
        >
          Huỷ
        </button>
        <button
          type="button"
          class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          [disabled]="!link() && !selectedId()"
          (click)="submit()"
        >
          {{ link() ? 'Lưu thay đổi' : 'Gắn quán' }}
        </button>
      </div>
    </app-modal>
  `,
})
export class LinkPlaceDialogComponent {
  private readonly placeService = inject(PlaceService);
  private readonly linkService = inject(PlaceLinkService);

  readonly girlfriendId = input.required<string>();
  readonly placeType = input.required<PlaceType>();
  /** null = gắn quán mới */
  readonly link = input<PlaceLink | null>(null);

  readonly save = output<PlaceLink>();
  readonly cancel = output<void>();

  protected readonly search = signal('');
  protected readonly selectedId = signal('');
  protected readonly herRating = signal(5);
  protected readonly visitedAt = signal(todayIso());
  protected readonly memory = signal('');

  protected readonly icon = computed(() => PLACE_ICONS[this.placeType()]);
  protected readonly heading = computed(() => `Gắn ${PLACE_LABELS[this.placeType()]}`);

  protected readonly placeName = computed(
    () => this.placeService.byId(this.link()?.placeId ?? '')?.name ?? '',
  );

  /** Quán cùng loại và chưa gắn với người này */
  protected readonly candidates = computed(() => {
    const linked = this.linkService.linkedPlaceIds(this.girlfriendId());
    const keyword = this.search().trim().toLowerCase();
    return this.placeService
      .byType(this.placeType())()
      .filter((p) => !linked.has(p.id))
      .filter((p) => !keyword || `${p.name} ${p.address}`.toLowerCase().includes(keyword));
  });

  ngOnInit(): void {
    const existing = this.link();
    if (!existing) return;
    this.selectedId.set(existing.placeId);
    this.herRating.set(existing.herRating);
    this.visitedAt.set(existing.lastVisitedAt);
    this.memory.set(existing.memory);
  }

  protected submit(): void {
    const existing = this.link();
    if (!existing && !this.selectedId()) return;

    this.save.emit({
      id: existing?.id ?? '',
      girlfriendId: this.girlfriendId(),
      placeId: existing?.placeId ?? this.selectedId(),
      placeType: this.placeType(),
      herRating: this.herRating(),
      lastVisitedAt: this.visitedAt(),
      memory: this.memory().trim(),
      createdAt: existing?.createdAt ?? nowIso(),
    });
  }
}
