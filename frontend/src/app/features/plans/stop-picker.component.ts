import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { DistrictOption } from '../../core/models/catalog.model';
import { StopKind, stopCategoryLabel, stopIcon } from '../../core/models/plan.model';
import { CatalogService } from '../../core/services/catalog.service';
import { SpotService } from '../../core/services/spot.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { ModalComponent } from '../../shared/ui/modal.component';

type Tab = 'place' | 'spot' | 'mine';

interface Option {
  kind: StopKind;
  id: string;
  name: string;
  category: string;
  districtLabel: string;
  imageUrl: string;
  hours: string;
}

/** Chọn một quán / chỗ chơi để thêm vào plan. Lọc sẵn theo khu vực của plan. */
@Component({
  selector: 'app-stop-picker',
  imports: [IconComponent, ModalComponent],
  template: `
    <app-modal title="Thêm điểm" subtitle="Quán trong Khám phá quán, chỗ chơi, hoặc quán bạn đã lưu" width="max-w-xl" (dismiss)="cancel.emit()">
      <div class="space-y-3">
        <div class="flex rounded-lg bg-slate-100 p-1 text-sm">
          @for (t of tabs; track t.value) {
            <button
              type="button"
              class="flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 font-medium"
              [class]="tab() === t.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'"
              (click)="tab.set(t.value); load()"
            >
              <app-icon [name]="t.icon" [size]="15" />{{ t.label }}
            </button>
          }
        </div>
        <div class="flex gap-2">
          <input
            type="search"
            class="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            placeholder="Tìm theo tên…"
            [value]="q()"
            (input)="onSearch($any($event.target).value)"
          />
          <select class="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm" [value]="district()" (change)="district.set($any($event.target).value); load()">
            <option value="">Mọi khu vực</option>
            @for (d of districts(); track d.code) {
              <option [value]="d.code">{{ d.label }}</option>
            }
          </select>
        </div>

        @if (options().length === 0) {
          <p class="py-8 text-center text-sm text-slate-500">
            {{ loading() ? 'Đang tải…' : tab() === 'mine' ? 'Chưa có quán nào trong My place ở khu vực này.' : 'Không có địa điểm phù hợp.' }}
          </p>
        }
        <ul class="divide-y divide-slate-100">
          @for (o of options(); track o.kind + o.id) {
            <li class="flex items-center gap-3 py-2.5">
              <div class="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-brand-50">
                @if (o.imageUrl) {
                  <img [src]="o.imageUrl" alt="" class="h-full w-full object-cover" loading="lazy" />
                } @else {
                  <div class="flex h-full items-center justify-center text-brand-400"><app-icon [name]="icon(o.category)" [size]="20" /></div>
                }
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold text-slate-900">{{ o.name }}</p>
                <p class="truncate text-xs text-slate-500">{{ label(o.category) }} · {{ o.districtLabel }}@if (o.hours) { · {{ o.hours }}}</p>
              </div>
              @if (exclude().includes(o.id)) {
                <span class="text-xs text-slate-400">Đã có</span>
              } @else {
                <button type="button" class="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700" (click)="pick.emit({ kind: o.kind, refId: o.id })">
                  <app-icon name="plus" [size]="14" />Thêm
                </button>
              }
            </li>
          }
        </ul>
      </div>
      <div modalFooter>
        <button type="button" class="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600" (click)="cancel.emit()">Xong</button>
      </div>
    </app-modal>
  `,
})
export class StopPickerComponent implements OnInit {
  private readonly catalog = inject(CatalogService);
  private readonly spots = inject(SpotService);
  private timer: ReturnType<typeof setTimeout> | undefined;

  /** Khu vực của plan: lọc sẵn */
  readonly initialDistrict = input<string | null>(null);
  readonly districts = input<DistrictOption[]>([]);
  /** id quán / chỗ chơi đã có trong plan */
  readonly exclude = input<string[]>([]);
  readonly pick = output<{ kind: StopKind; refId: string }>();
  readonly cancel = output<void>();

  protected readonly tabs: { value: Tab; label: string; icon: 'utensils' | 'gate' | 'bookmark' }[] = [
    { value: 'place', label: 'Quán', icon: 'utensils' },
    { value: 'spot', label: 'Chỗ chơi', icon: 'gate' },
    { value: 'mine', label: 'My place', icon: 'bookmark' },
  ];
  protected readonly tab = signal<Tab>('place');
  protected readonly q = signal('');
  protected readonly district = signal('');
  protected readonly options = signal<Option[]>([]);
  protected readonly loading = signal(false);

  ngOnInit(): void {
    this.district.set(this.initialDistrict() ?? '');
    void this.load();
  }

  protected icon(category: string) {
    return stopIcon(category);
  }

  protected label(category: string) {
    return stopCategoryLabel(category);
  }

  protected onSearch(value: string): void {
    this.q.set(value);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.load(), 250);
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    const q = this.q().trim() || undefined;
    const district = this.district() || undefined;
    try {
      if (this.tab() === 'spot') {
        const page = await this.spots.search({ q, district, size: 50 });
        this.options.set(
          page.items.map((s) => ({
            kind: 'spot',
            id: s.id,
            name: s.name,
            category: s.category,
            districtLabel: s.districtLabel,
            imageUrl: s.imageUrl,
            hours: s.openTime && s.closeTime ? `${s.openTime}–${s.closeTime}` : '',
          })),
        );
      } else {
        const page = await this.catalog.search({ q, district, mine: this.tab() === 'mine' || undefined, size: 50 });
        this.options.set(
          page.items.map((c) => ({
            kind: 'place',
            id: c.id,
            name: c.name,
            category: c.type,
            districtLabel: c.districtLabel,
            imageUrl: c.imageUrl,
            hours: `${c.openTime}–${c.closeTime}`,
          })),
        );
      }
    } finally {
      this.loading.set(false);
    }
  }
}
