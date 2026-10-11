import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { errorCode } from '../../core/api/api';
import { DistrictOption, ImportRun } from '../../core/models/catalog.model';
import { PlaceType } from '../../core/models/place.model';
import { CatalogService } from '../../core/services/catalog.service';

const TYPES: { value: PlaceType; label: string }[] = [
  { value: 'cafe', label: 'Cafe' },
  { value: 'restaurant', label: 'Nhà hàng' },
  { value: 'bar', label: 'Bar' },
];

/**
 * Chỉ admin: nhập "Khám phá quán" từ OpenStreetMap theo quận và loại quán. Lượt nhập chạy nền ở
 * server; trang hỏi lại 2 giây một lần khi đang chạy để hiện tiến trình.
 */
@Component({
  selector: 'app-catalog-admin-page',
  imports: [DatePipe, RouterLink],
  template: `
    <div class="p-4 sm:p-6 lg:p-8">
      <div class="mb-6">
        <h1 class="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <span>🗺️</span> Nguồn dữ liệu quán
        </h1>
        <p class="mt-1 text-sm text-slate-500">
          Lấy danh sách quán từ OpenStreetMap vào
          <a routerLink="/explore" class="font-medium text-brand-600 hover:text-brand-700">Khám phá quán</a>
        </p>
      </div>

      <div class="max-w-3xl space-y-5">
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 class="mb-3 font-semibold text-slate-800">Nhập mới / cập nhật</h2>

          <div class="mb-2 flex items-center justify-between">
            <span class="text-sm font-medium text-slate-700">Khu vực (quận nội thành Hà Nội)</span>
            <button type="button" class="text-xs font-medium text-brand-600 hover:text-brand-700" (click)="toggleAllDistricts()">
              {{ selectedDistricts().size === districts().length ? 'Bỏ chọn tất cả' : 'Chọn tất cả' }}
            </button>
          </div>
          <div class="mb-4 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            @for (d of districts(); track d.code) {
              <label class="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  class="h-4 w-4 accent-brand-600"
                  [checked]="selectedDistricts().has(d.code)"
                  (change)="toggle(selectedDistricts, d.code)"
                />
                {{ d.label }}
              </label>
            }
          </div>

          <span class="mb-2 block text-sm font-medium text-slate-700">Loại quán</span>
          <div class="mb-4 flex flex-wrap gap-4">
            @for (t of types; track t.value) {
              <label class="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  class="h-4 w-4 accent-brand-600"
                  [checked]="selectedTypes().has(t.value)"
                  (change)="toggle(selectedTypes, t.value)"
                />
                {{ t.label }}
              </label>
            }
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <p class="flex-1 text-xs text-slate-500">
              {{ selectedDistricts().size * selectedTypes().size }} lượt truy vấn, mỗi lượt nghỉ vài giây để
              không làm quá tải máy chủ OSM. Có thể rời trang, việc nhập vẫn chạy.
            </p>
            <button
              type="button"
              class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
              [disabled]="!canStart()"
              (click)="start()"
            >
              {{ starting() ? 'Đang bắt đầu…' : '⟳ Bắt đầu nhập' }}
            </button>
          </div>

          @if (running(); as run) {
            <div class="mt-4 rounded-lg bg-brand-50 px-3 py-2.5">
              <div class="mb-1.5 flex justify-between text-xs text-brand-800">
                <span>Đang chạy: {{ run.doneCells }}/{{ run.totalCells }} lượt · +{{ run.added }} mới · {{ run.updated }} cập nhật</span>
                <span>{{ percent(run) }}%</span>
              </div>
              <div class="h-2 overflow-hidden rounded-full bg-brand-100">
                <div class="h-full bg-brand-600 transition-all" [style.width.%]="percent(run)"></div>
              </div>
            </div>
          }
        </div>

        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 class="mb-3 font-semibold text-slate-800">Lịch sử</h2>
          @if (runs().length === 0) {
            <p class="text-sm text-slate-500">Chưa có lượt nhập nào.</p>
          } @else {
            <ul class="divide-y divide-slate-100">
              @for (run of runs(); track run.id) {
                <li class="py-2.5 text-sm">
                  <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span class="text-slate-500">{{ run.startedAt | date: 'dd/MM/yyyy HH:mm' }}</span>
                    <span class="flex-1 text-slate-700">
                      {{ run.districts.length }} quận · {{ typeLabels(run.types) }}
                    </span>
                    <span class="text-slate-600">+{{ run.added }} mới · {{ run.updated }} cập nhật</span>
                    <span>{{ run.status === 'DONE' ? (run.errors.length ? '⚠️' : '✅') : run.status === 'FAILED' ? '❌' : '⏳' }}</span>
                  </div>
                  <p class="mt-0.5 text-xs text-slate-400">{{ run.districts.join(', ') }}</p>
                  @for (e of run.errors; track $index) {
                    <p class="mt-0.5 text-xs text-rose-600">{{ e }}</p>
                  }
                </li>
              }
            </ul>
          }
        </div>
      </div>
    </div>
  `,
})
export class CatalogAdminPage implements OnInit, OnDestroy {
  private readonly catalog = inject(CatalogService);

  protected readonly types = TYPES;
  protected readonly districts = signal<DistrictOption[]>([]);
  protected readonly selectedDistricts = signal(new Set<string>());
  protected readonly selectedTypes = signal(new Set<string>(TYPES.map((t) => t.value)));
  protected readonly runs = signal<ImportRun[]>([]);
  protected readonly starting = signal(false);
  protected readonly running = computed(() => this.runs().find((r) => r.status === 'RUNNING') ?? null);
  protected readonly canStart = computed(
    () =>
      !this.starting() &&
      !this.running() &&
      this.selectedDistricts().size > 0 &&
      this.selectedTypes().size > 0,
  );
  private pollTimer?: ReturnType<typeof setTimeout>;

  async ngOnInit(): Promise<void> {
    const [districts] = await Promise.all([this.catalog.districts(), this.refreshRuns()]);
    this.districts.set(districts);
  }

  ngOnDestroy(): void {
    clearTimeout(this.pollTimer);
  }

  protected toggle(set: typeof this.selectedDistricts, value: string): void {
    const next = new Set(set());
    if (next.has(value)) next.delete(value);
    else next.add(value);
    set.set(next);
  }

  protected toggleAllDistricts(): void {
    const all = this.selectedDistricts().size === this.districts().length;
    this.selectedDistricts.set(new Set(all ? [] : this.districts().map((d) => d.code)));
  }

  protected async start(): Promise<void> {
    this.starting.set(true);
    try {
      await this.catalog.startImport([...this.selectedDistricts()], [...this.selectedTypes()] as PlaceType[]);
    } catch (err) {
      // Lượt khác đang chạy (ví dụ mở ở tab khác): chỉ cần tải lại để thấy tiến trình
      if (errorCode(err) !== 'IMPORT_RUNNING') return;
    } finally {
      this.starting.set(false);
    }
    await this.refreshRuns();
  }

  protected percent(run: ImportRun): number {
    return run.totalCells ? Math.round((run.doneCells / run.totalCells) * 100) : 0;
  }

  protected typeLabels(types: PlaceType[]): string {
    return types.map((t) => TYPES.find((x) => x.value === t)?.label ?? t).join(', ');
  }

  /** Đang có lượt chạy thì hỏi lại sau 2 giây. */
  private async refreshRuns(): Promise<void> {
    clearTimeout(this.pollTimer);
    this.runs.set(await this.catalog.runs());
    if (this.running()) this.pollTimer = setTimeout(() => void this.refreshRuns(), 2000);
  }
}
