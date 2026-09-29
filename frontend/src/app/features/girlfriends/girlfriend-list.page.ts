import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GirlfriendService } from '../../core/services/girlfriend.service';
import { PlaceLinkService } from '../../core/services/place-link.service';
import {
  Girlfriend,
  RELATIONSHIP_STATUSES,
  statusMeta,
} from '../../core/models/girlfriend.model';
import { GirlfriendFormComponent } from './girlfriend-form.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog.component';
import { PlaceType } from '../../core/models/place.model';
import { daysSince } from '../../core/utils/id';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-girlfriend-list-page',
  imports: [RouterLink, GirlfriendFormComponent, EmptyStateComponent, ConfirmDialogComponent],
  template: `
    <div class="p-4 sm:p-6 lg:p-8">
      <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <span>👩</span> Quản lý người yêu
        </h1>
        <p class="mt-1 text-sm text-slate-500">
          Hồ sơ từng người và những quán đã đi cùng
        </p>
      </div>
      @if (canEdit()) {
        <button
          type="button"
          class="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          (click)="openCreate()"
        >
          + Thêm người yêu
        </button>
      }
    </div>

    <div class="mb-6 flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="rounded-full px-3.5 py-1.5 text-xs font-medium transition"
        [class]="
          statusFilter() === ''
            ? 'bg-brand-100 text-brand-700'
            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
        "
        (click)="statusFilter.set('')"
      >
        Tất cả ({{ all().length }})
      </button>
      @for (s of statuses; track s.value) {
        <button
          type="button"
          class="rounded-full px-3.5 py-1.5 text-xs font-medium transition"
          [class]="
            statusFilter() === s.value
              ? 'bg-brand-100 text-brand-700'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          "
          (click)="statusFilter.set(s.value)"
        >
          {{ s.label }} ({{ countByStatus(s.value) }})
        </button>
      }
    </div>

    @if (visible().length === 0) {
      <app-empty-state
        icon="💔"
        [title]="all().length ? 'Không có ai ở trạng thái này' : 'Danh sách còn trống'"
        [description]="
          all().length
            ? 'Chọn bộ lọc khác để xem những người còn lại.'
            : 'Thêm hồ sơ đầu tiên để bắt đầu lưu kỷ niệm và các quán đã đi cùng.'
        "
      >
        @if (!all().length && canEdit()) {
          <button
            type="button"
            class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
            (click)="openCreate()"
          >
            Thêm người yêu
          </button>
        }
      </app-empty-state>
    } @else {
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        @for (gf of visible(); track gf.id) {
          <article
            class="flex flex-col rounded-xl border border-slate-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-md"
          >
            <div class="flex items-start gap-4">
              <a
                [routerLink]="['/girlfriends', gf.id]"
                class="shrink-0 transition hover:opacity-80"
                [attr.aria-label]="'Xem chi tiết ' + gf.name"
              >
                @if (gf.avatarUrl) {
                  <img
                    [src]="gf.avatarUrl"
                    [alt]="gf.name"
                    class="h-16 w-16 rounded-full object-cover ring-2 ring-brand-100"
                    loading="lazy"
                  />
                } @else {
                  <div
                    class="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-2xl"
                  >
                    👤
                  </div>
                }
              </a>

              <div class="min-w-0 flex-1">
                <h3 class="truncate font-semibold text-slate-900">{{ gf.name }}</h3>
                @if (gf.nickname) {
                  <p class="truncate text-sm text-slate-500">"{{ gf.nickname }}"</p>
                }
                <span
                  class="mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
                  [class]="badge(gf)"
                >
                  {{ statusText(gf) }}
                </span>
              </div>
            </div>

            <dl class="mt-4 grid grid-cols-4 gap-1 rounded-lg bg-slate-50 p-3 text-center">
              <div>
                <dt class="text-[11px] text-slate-400">Bên nhau</dt>
                <dd class="text-sm font-semibold text-slate-700">{{ together(gf) }}</dd>
              </div>
              <div>
                <dt class="text-[11px] text-slate-400">Quán ăn</dt>
                <dd class="text-sm font-semibold text-slate-700">{{ countOf(gf.id, 'restaurant') }}</dd>
              </div>
              <div>
                <dt class="text-[11px] text-slate-400">Cafe</dt>
                <dd class="text-sm font-semibold text-slate-700">{{ countOf(gf.id, 'cafe') }}</dd>
              </div>
              <div>
                <dt class="text-[11px] text-slate-400">Bar</dt>
                <dd class="text-sm font-semibold text-slate-700">{{ countOf(gf.id, 'bar') }}</dd>
              </div>
            </dl>

            @if (gf.hobbies.length) {
              <div class="mt-3 flex flex-wrap gap-1.5">
                @for (hobby of gf.hobbies; track hobby) {
                  <span class="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {{ hobby }}
                  </span>
                }
              </div>
            }

            <div class="mt-auto flex items-center gap-2 pt-4">
              <a
                [routerLink]="['/girlfriends', gf.id]"
                class="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-center text-xs font-semibold text-white transition hover:bg-slate-700"
              >
                Xem chi tiết
              </a>
              @if (canEdit()) {
                <button
                  type="button"
                  class="rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-600 transition hover:bg-slate-50"
                  (click)="openEdit(gf)"
                  title="Sửa"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  class="rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-rose-600 transition hover:bg-rose-50"
                  (click)="pendingDelete.set(gf)"
                  title="Xoá"
                >
                  🗑️
                </button>
              }
            </div>
          </article>
        }
      </div>
    }

    @if (formOpen()) {
      <app-girlfriend-form
        [girlfriend]="editing()"
        (save)="handleSave($event)"
        (cancel)="closeForm()"
      />
    }

    @if (pendingDelete(); as target) {
      <app-confirm-dialog
        title="Xoá hồ sơ này?"
        [message]="
          'Xoá &quot;' +
          target.name +
          '&quot; sẽ xoá luôn toàn bộ quán đã gắn và kỷ niệm kèm theo.'
        "
        (confirm)="confirmDelete()"
        (cancel)="pendingDelete.set(null)"
      />
    }
    </div>
  `,
})
export class GirlfriendListPage {
  private readonly service = inject(GirlfriendService);
  private readonly links = inject(PlaceLinkService);
  /** Guest chỉ xem: ẩn nút thêm/sửa/xoá (server cũng chặn request ghi). */
  protected readonly canEdit = inject(AuthService).canEdit;

  protected readonly statuses = RELATIONSHIP_STATUSES;
  protected readonly statusFilter = signal('');
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<Girlfriend | null>(null);
  protected readonly pendingDelete = signal<Girlfriend | null>(null);
  protected readonly saving = signal(false);

  protected readonly all = computed(() => this.service.items());
  protected readonly visible = computed(() => {
    const filter = this.statusFilter();
    return this.all().filter((gf) => !filter || gf.status === filter);
  });

  protected countByStatus(status: string): number {
    return this.all().filter((gf) => gf.status === status).length;
  }

  protected countOf(id: string, type: PlaceType): number {
    return this.links.forGirlfriend(id, type).length;
  }

  protected statusText(gf: Girlfriend): string {
    return statusMeta(gf.status).label;
  }

  protected badge(gf: Girlfriend): string {
    return statusMeta(gf.status).classes;
  }

  protected together(gf: Girlfriend): string {
    const days = daysSince(gf.startedDate);
    if (days < 0) return '–';
    if (days < 30) return `${days} ngày`;
    if (days < 365) return `${Math.floor(days / 30)} tháng`;
    return `${(days / 365).toFixed(1)} năm`;
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.formOpen.set(true);
  }

  protected openEdit(gf: Girlfriend): void {
    this.editing.set(gf);
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.editing.set(null);
  }

  protected async handleSave(gf: Girlfriend): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    const existing = this.editing();
    const { id, ...data } = gf;
    try {
      if (existing) {
        await this.service.update(existing.id, data);
      } else {
        await this.service.create(data);
      }
      this.closeForm();
    } catch {
      // giữ form mở, toast đã hiện
    } finally {
      this.saving.set(false);
    }
  }

  protected async confirmDelete(): Promise<void> {
    const target = this.pendingDelete();
    if (!target) return;
    this.pendingDelete.set(null);
    try {
      await this.service.remove(target.id);
      // Server đã xoá link theo (ON DELETE CASCADE)
      this.links.dropByGirlfriend(target.id);
    } catch {
      // store đã hoàn tác
    }
  }
}
