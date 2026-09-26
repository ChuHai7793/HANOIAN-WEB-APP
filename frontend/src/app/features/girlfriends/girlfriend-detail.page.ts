import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GirlfriendService } from '../../core/services/girlfriend.service';
import { PlaceLinkService } from '../../core/services/place-link.service';
import { PlaceService } from '../../core/services/place.service';
import { Girlfriend, statusMeta } from '../../core/models/girlfriend.model';
import {
  Place,
  PLACE_ICONS,
  PLACE_LABELS,
  PlaceType,
  priceLabel,
} from '../../core/models/place.model';
import { PlaceLink } from '../../core/models/place-link.model';
import { GirlfriendFormComponent } from './girlfriend-form.component';
import { LinkPlaceDialogComponent } from './link-place-dialog.component';
import { RatingStarsComponent } from '../../shared/ui/rating-stars.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog.component';
import { ModalComponent } from '../../shared/ui/modal.component';
import { directionsUrl, routeUrl } from '../../core/utils/gmap-url';
import { daysSince } from '../../core/utils/id';

type Tab = 'info' | PlaceType;

interface LinkedPlace {
  link: PlaceLink;
  place: Place;
}

@Component({
  selector: 'app-girlfriend-detail-page',
  imports: [
    RouterLink,
    GirlfriendFormComponent,
    LinkPlaceDialogComponent,
    RatingStarsComponent,
    EmptyStateComponent,
    ConfirmDialogComponent,
    ModalComponent,
  ],
  template: `
    <div class="p-4 sm:p-6 lg:p-8">
    @if (girlfriend(); as gf) {
      <a
        routerLink="/girlfriends"
        class="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-800"
      >
        ← Về danh sách
      </a>

      <!-- Hồ sơ -->
      <div class="rounded-2xl border border-slate-200 bg-white p-6">
        <div class="flex flex-wrap items-start gap-5">
          @if (gf.avatarUrl) {
            <img
              [src]="gf.avatarUrl"
              [alt]="gf.name"
              class="h-24 w-24 rounded-2xl object-cover ring-4 ring-brand-50"
            />
          } @else {
            <div class="flex h-24 w-24 items-center justify-center rounded-2xl bg-brand-50 text-4xl">
              👤
            </div>
          }

          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2.5">
              <h1 class="text-2xl font-bold text-slate-900">{{ gf.name }}</h1>
              <span
                class="rounded-full px-2.5 py-0.5 text-xs font-medium"
                [class]="statusClasses(gf)"
              >
                {{ statusLabel(gf) }}
              </span>
            </div>
            @if (gf.nickname) {
              <p class="mt-0.5 text-sm text-slate-500">Thường gọi: "{{ gf.nickname }}"</p>
            }

            <div class="mt-4 flex flex-wrap gap-6">
              <div>
                <p class="text-[11px] uppercase tracking-wide text-slate-400">Bên nhau</p>
                <p class="text-lg font-semibold text-slate-800">{{ togetherDays() }} ngày</p>
              </div>
              <div>
                <p class="text-[11px] uppercase tracking-wide text-slate-400">Sinh nhật tới</p>
                <p class="text-lg font-semibold text-slate-800">
                  {{ daysToBirthday() === null ? '–' : 'còn ' + daysToBirthday() + ' ngày' }}
                </p>
              </div>
              <div>
                <p class="text-[11px] uppercase tracking-wide text-slate-400">Quán đã đi</p>
                <p class="text-lg font-semibold text-slate-800">{{ totalPlaces() }}</p>
              </div>
            </div>
          </div>

          <div class="flex gap-2">
            <button
              type="button"
              class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
              (click)="suggest()"
            >
              🎲 Gợi ý hẹn hò
            </button>
            <button
              type="button"
              class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              (click)="editOpen.set(true)"
            >
              ✏️ Sửa
            </button>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="mt-6 flex gap-1 border-b border-slate-200">
        @for (t of tabs; track t.key) {
          <button
            type="button"
            class="-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition"
            [class]="
              tab() === t.key
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            "
            (click)="tab.set(t.key)"
          >
            {{ t.label }}
            @if (t.key !== 'info') {
              <span class="ml-1 text-xs text-slate-400">({{ countOf(t.key) }})</span>
            }
          </button>
        }
      </div>

      <div class="mt-6">
        <!-- Tab thông tin -->
        @if (tab() === 'info') {
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="rounded-xl border border-slate-200 bg-white p-5">
              <h3 class="mb-4 text-sm font-semibold text-slate-800">Thông tin cơ bản</h3>
              <dl class="space-y-3 text-sm">
                <div class="flex justify-between gap-4">
                  <dt class="text-slate-500">Điện thoại</dt>
                  <dd class="font-medium text-slate-800">{{ gf.phone || '–' }}</dd>
                </div>
                <div class="flex justify-between gap-4">
                  <dt class="text-slate-500">Sinh nhật</dt>
                  <dd class="font-medium text-slate-800">{{ formatDate(gf.birthday) }}</dd>
                </div>
                <div class="flex justify-between gap-4">
                  <dt class="text-slate-500">Ngày quen</dt>
                  <dd class="font-medium text-slate-800">{{ formatDate(gf.startedDate) }}</dd>
                </div>
                <div class="flex justify-between gap-4">
                  <dt class="text-slate-500">Trạng thái</dt>
                  <dd class="font-medium text-slate-800">{{ statusLabel(gf) }}</dd>
                </div>
              </dl>
            </div>

            <div class="rounded-xl border border-slate-200 bg-white p-5">
              <h3 class="mb-4 text-sm font-semibold text-slate-800">Sở thích</h3>
              @if (gf.hobbies.length) {
                <div class="flex flex-wrap gap-2">
                  @for (hobby of gf.hobbies; track hobby) {
                    <span class="rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-700">
                      {{ hobby }}
                    </span>
                  }
                </div>
              } @else {
                <p class="text-sm text-slate-400">Chưa ghi nhận sở thích nào.</p>
              }

              <h3 class="mb-2 mt-6 text-sm font-semibold text-slate-800">Ghi chú</h3>
              <p class="whitespace-pre-line text-sm leading-relaxed text-slate-600">
                {{ gf.note || 'Chưa có ghi chú.' }}
              </p>
            </div>
          </div>
        } @else {
          <!-- Tab quán ăn / quán cafe -->
          <div class="mb-4 flex items-center justify-between">
            <p class="text-sm text-slate-500">
              Danh sách {{ tabLabel() }} đã đi cùng {{ gf.nickname || gf.name }}
            </p>
            <button
              type="button"
              class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
              (click)="openLink()"
            >
              + Gắn {{ tabLabel() }}
            </button>
          </div>

          @if (currentList().length === 0) {
            <app-empty-state
              [icon]="tabIcon()"
              title="Chưa gắn quán nào"
              description="Gắn những quán hai người đã đi để lần sau còn nhớ mà quay lại."
            >
              <button
                type="button"
                class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
                (click)="openLink()"
              >
                Gắn quán ngay
              </button>
            </app-empty-state>
          } @else {
            <div class="space-y-3">
              @for (row of currentList(); track row.link.id) {
                <article class="rounded-xl border border-slate-200 bg-white p-4">
                  <div class="flex flex-wrap items-start gap-4">
                    @if (row.place.imageUrl) {
                      <img
                        [src]="row.place.imageUrl"
                        [alt]="row.place.name"
                        class="h-20 w-20 shrink-0 rounded-lg object-cover"
                        loading="lazy"
                      />
                    } @else {
                      <div class="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-2xl">
                        {{ tabIcon() }}
                      </div>
                    }

                    <div class="min-w-0 flex-1">
                      <h3 class="font-semibold text-slate-900">{{ row.place.name }}</h3>
                      <p class="mt-0.5 text-sm text-slate-500">
                        {{ row.place.address }} · {{ priceText(row.place) }}
                      </p>

                      <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                        <div class="flex items-center gap-1.5">
                          <span class="text-xs text-slate-400">Nàng chấm:</span>
                          <app-rating-stars [value]="row.link.herRating" />
                        </div>
                        <span class="text-xs text-slate-400">
                          Lần cuối: {{ formatDate(row.link.lastVisitedAt) }}
                        </span>
                      </div>

                      @if (row.link.memory) {
                        <p class="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm italic text-amber-900">
                          💭 {{ row.link.memory }}
                        </p>
                      }
                    </div>

                    <div class="flex shrink-0 gap-2">
                      <a
                        [href]="directions(row.place)"
                        target="_blank"
                        rel="noopener"
                        class="rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-600 transition hover:bg-slate-50"
                        title="Chỉ đường"
                      >
                        🧭
                      </a>
                      <button
                        type="button"
                        class="rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-slate-600 transition hover:bg-slate-50"
                        (click)="editLink(row.link)"
                        title="Sửa kỷ niệm"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        class="rounded-lg border border-slate-200 px-2.5 py-2 text-xs text-rose-600 transition hover:bg-rose-50"
                        (click)="pendingUnlink.set(row)"
                        title="Gỡ quán"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </article>
              }
            </div>
          }
        }
      </div>

      <!-- Sửa hồ sơ -->
      @if (editOpen()) {
        <app-girlfriend-form
          [girlfriend]="gf"
          (save)="saveProfile($event)"
          (cancel)="editOpen.set(false)"
        />
      }

      <!-- Gắn / sửa liên kết quán -->
      @if (linkDialogOpen()) {
        <app-link-place-dialog
          [girlfriendId]="gf.id"
          [placeType]="linkType()"
          [link]="editingLink()"
          (save)="saveLink($event)"
          (cancel)="closeLinkDialog()"
        />
      }

      <!-- Xác nhận gỡ quán -->
      @if (pendingUnlink(); as row) {
        <app-confirm-dialog
          title="Gỡ quán khỏi hồ sơ?"
          [message]="
            'Gỡ &quot;' + row.place.name + '&quot; sẽ xoá kỷ niệm đã ghi. Quán vẫn còn trong danh sách chung.'
          "
          confirmLabel="Gỡ"
          (confirm)="confirmUnlink()"
          (cancel)="pendingUnlink.set(null)"
        />
      }

      <!-- Gợi ý hẹn hò -->
      @if (suggestion(); as s) {
        <app-modal
          title="Gợi ý buổi hẹn"
          [subtitle]="'Chọn từ những quán ' + (gf.nickname || gf.name) + ' chấm điểm cao'"
          width="max-w-lg"
          (dismiss)="suggestion.set(null)"
        >
          <div class="space-y-3">
            @for (stop of s.stops; track stop.place.id) {
              <div class="rounded-xl border border-slate-200 p-4">
                <p class="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {{ stop.label }}
                </p>
                <p class="mt-1 font-semibold text-slate-900">{{ stop.place.name }}</p>
                <p class="text-sm text-slate-500">{{ stop.place.address }}</p>
              </div>
            } @empty {
              <p class="py-4 text-center text-sm text-slate-500">
                Chưa gắn quán nào cho {{ gf.nickname || gf.name }} nên chưa gợi ý được.
              </p>
            }
          </div>

          <div modalFooter class="contents">
            <button
              type="button"
              class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              (click)="suggest()"
            >
              🎲 Đổi gợi ý
            </button>
            @if (s.routeLink) {
              <a
                [href]="s.routeLink"
                target="_blank"
                rel="noopener"
                class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                🗺️ Xem lộ trình
              </a>
            }
          </div>
        </app-modal>
      }
    } @else {
      <app-empty-state
        icon="🔍"
        title="Không tìm thấy hồ sơ"
        description="Hồ sơ này có thể đã bị xoá."
      >
        <a
          routerLink="/girlfriends"
          class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Về danh sách
        </a>
      </app-empty-state>
    }
    </div>
  `,
})
export class GirlfriendDetailPage {
  private readonly service = inject(GirlfriendService);
  private readonly linkService = inject(PlaceLinkService);
  private readonly placeService = inject(PlaceService);

  /** Lấy từ tham số :id của route nhờ withComponentInputBinding() */
  readonly id = input.required<string>();

  protected readonly tabs: { key: Tab; label: string }[] = [
    { key: 'info', label: 'Thông tin' },
    { key: 'restaurant', label: 'Quán ăn' },
    { key: 'cafe', label: 'Quán cafe' },
    { key: 'bar', label: 'Quán bar' },
  ];

  protected readonly tab = signal<Tab>('info');
  protected readonly editOpen = signal(false);
  protected readonly linkDialogOpen = signal(false);
  protected readonly editingLink = signal<PlaceLink | null>(null);
  protected readonly pendingUnlink = signal<LinkedPlace | null>(null);
  protected readonly suggestion = signal<{
    stops: { label: string; place: Place }[];
    routeLink: string;
  } | null>(null);

  protected readonly girlfriend = computed(() =>
    this.service.items().find((gf) => gf.id === this.id()),
  );

  protected readonly cafes = computed(() => this.linkedOf('cafe'));
  protected readonly restaurants = computed(() => this.linkedOf('restaurant'));
  protected readonly bars = computed(() => this.linkedOf('bar'));

  protected readonly linkType = computed<PlaceType>(() => {
    const tab = this.tab();
    return tab === 'info' ? 'cafe' : tab;
  });

  protected readonly currentList = computed(() => this.listOf(this.linkType()));
  protected readonly tabIcon = computed(() => PLACE_ICONS[this.linkType()]);
  protected readonly tabLabel = computed(() => PLACE_LABELS[this.linkType()]);
  protected readonly totalPlaces = computed(
    () => this.restaurants().length + this.cafes().length + this.bars().length,
  );

  protected readonly togetherDays = computed(() => {
    const gf = this.girlfriend();
    return gf ? Math.max(0, daysSince(gf.startedDate)) : 0;
  });

  protected readonly daysToBirthday = computed(() => {
    const gf = this.girlfriend();
    if (!gf?.birthday) return null;
    const birth = new Date(gf.birthday);
    if (Number.isNaN(birth.getTime())) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
    if (next < today) next.setFullYear(next.getFullYear() + 1);
    return Math.round((next.getTime() - today.getTime()) / 86_400_000);
  });

  private listOf(type: PlaceType): LinkedPlace[] {
    switch (type) {
      case 'cafe':
        return this.cafes();
      case 'bar':
        return this.bars();
      default:
        return this.restaurants();
    }
  }

  /** Số quán đã gắn theo từng tab, dùng cho badge trên thanh tab */
  protected countOf(tab: Tab): number {
    return tab === 'info' ? 0 : this.listOf(tab).length;
  }

  private linkedOf(type: PlaceType): LinkedPlace[] {
    const gf = this.girlfriend();
    if (!gf) return [];
    return this.linkService
      .forGirlfriend(gf.id, type)
      .map((link) => ({ link, place: this.placeService.byId(link.placeId) }))
      .filter((row): row is LinkedPlace => !!row.place)
      .sort((a, b) => b.link.herRating - a.link.herRating);
  }

  protected statusLabel(gf: Girlfriend): string {
    return statusMeta(gf.status).label;
  }

  protected statusClasses(gf: Girlfriend): string {
    return statusMeta(gf.status).classes;
  }

  protected priceText(place: Place): string {
    return priceLabel(place.priceRange);
  }

  protected formatDate(value: string): string {
    if (!value) return '–';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '–';
    return d.toLocaleDateString('vi-VN');
  }

  protected directions(place: Place): string {
    return directionsUrl(place.lat, place.lng, `${place.name} ${place.address}`);
  }

  protected saveProfile(gf: Girlfriend): void {
    const { id, ...changes } = gf;
    this.service.update(this.id(), changes);
    this.editOpen.set(false);
  }

  protected openLink(): void {
    this.editingLink.set(null);
    this.linkDialogOpen.set(true);
  }

  protected editLink(link: PlaceLink): void {
    this.editingLink.set(link);
    this.linkDialogOpen.set(true);
  }

  protected closeLinkDialog(): void {
    this.linkDialogOpen.set(false);
    this.editingLink.set(null);
  }

  protected saveLink(link: PlaceLink): void {
    const existing = this.editingLink();
    const { id, ...data } = link;
    if (existing) {
      this.linkService.update(existing.id, data);
    } else {
      this.linkService.create(data);
    }
    this.closeLinkDialog();
  }

  protected confirmUnlink(): void {
    const row = this.pendingUnlink();
    if (!row) return;
    this.linkService.remove(row.link.id);
    this.pendingUnlink.set(null);
  }

  /** Bốc ngẫu nhiên trong nhóm quán nàng chấm từ 4 sao trở lên */
  protected suggest(): void {
    const pick = (rows: LinkedPlace[]): Place | null => {
      const liked = rows.filter((r) => r.link.herRating >= 4);
      const pool = liked.length ? liked : rows;
      if (!pool.length) return null;
      return pool[Math.floor(Math.random() * pool.length)].place;
    };

    const plan: { label: string; place: Place | null }[] = [
      { label: 'Ăn tối', place: pick(this.restaurants()) },
      { label: 'Cafe sau đó', place: pick(this.cafes()) },
      { label: 'Kết thúc ở bar', place: pick(this.bars()) },
    ];
    const stops = plan.filter(
      (s): s is { label: string; place: Place } => !!s.place,
    );

    this.suggestion.set({
      stops,
      routeLink:
        stops.length >= 2
          ? routeUrl(
              stops.map((s) => ({
                lat: s.place.lat,
                lng: s.place.lng,
                name: `${s.place.name} ${s.place.address}`,
              })),
            )
          : '',
    });
  }
}
