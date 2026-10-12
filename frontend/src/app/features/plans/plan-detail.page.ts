import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { errorCode, problemOf } from '../../core/api/api';
import { AuthService } from '../../core/auth/auth.service';
import { DistrictOption } from '../../core/models/catalog.model';
import {
  directionsUrl,
  distanceText,
  Plan,
  PLAN_BUDGETS,
  PLAN_STATUSES,
  planStatusMeta,
  PlanStatus,
  PlanStop,
  STOP_WARNINGS,
  StopKind,
  stopCategoryLabel,
  stopIcon,
  StopWarning,
} from '../../core/models/plan.model';
import { Vibe, vibeMeta, VIBES } from '../../core/models/vibe.model';
import { CatalogService } from '../../core/services/catalog.service';
import { DataBootstrapService } from '../../core/services/data-bootstrap.service';
import { GirlfriendService } from '../../core/services/girlfriend.service';
import { MatchInboxService } from '../../core/services/match-inbox.service';
import { PlanService } from '../../core/services/plan.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { ModalComponent } from '../../shared/ui/modal.component';
import { PlanMapComponent } from './plan-map.component';
import { StopPickerComponent } from './stop-picker.component';

const INPUT = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500';
const DURATIONS = [30, 45, 60, 75, 90, 120, 150, 180, 240];

/**
 * Một plan: dòng thời gian các điểm (giờ tới / rời tự tính, quãng đường, cảnh báo), thêm / đổi thứ tự / Đổi /
 * xoá điểm, bản đồ, rủ đi qua tin nhắn, sau buổi hẹn chấm điểm và ghi kỷ niệm. Plan người khác rủ: chỉ xem.
 */
@Component({
  selector: 'app-plan-detail-page',
  imports: [RouterLink, IconComponent, ModalComponent, ConfirmDialogComponent, StopPickerComponent, PlanMapComponent],
  template: `
    <div class="mx-auto flex max-w-4xl flex-col gap-4 px-4 pb-10 pt-4 sm:px-6 lg:pt-5">
      <a routerLink="/plans" class="flex w-fit items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <span class="rotate-180"><app-icon name="arrowRight" [size]="16" /></span>Tất cả plan
      </a>

      @if (gone()) {
        <div class="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Plan này không còn, hoặc bạn không có quyền xem.
        </div>
      } @else if (plan(); as p) {
        @if (!p.mine) {
          <div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
            <span class="flex items-center gap-2"><app-icon name="heart" [size]="16" />{{ p.ownerName }} rủ bạn đi theo plan này.</span>
            <button type="button" class="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700" (click)="copy()">Lưu về plan của tôi</button>
          </div>
        }

        <header class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex flex-col gap-2">
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-[22px] font-extrabold tracking-tight text-slate-900">{{ p.title }}</h1>
              <span class="rounded-full px-2.5 py-1 text-xs font-semibold" [class]="statusMeta(p.status).classes">{{ statusMeta(p.status).label }}</span>
            </div>
            <p class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
              <span class="flex items-center gap-1"><app-icon name="calendar" [size]="15" />{{ p.date ? dateText(p.date) : 'Chưa chọn ngày' }}</span>
              <span class="flex items-center gap-1"><app-icon name="clock" [size]="15" />{{ p.startTime }}–{{ p.endTime }}</span>
              @if (p.districtLabel) {
                <span class="flex items-center gap-1"><app-icon name="pin" [size]="15" />{{ p.districtLabel }}</span>
              }
              @if (p.totalDistanceM) {
                <span class="flex items-center gap-1"><app-icon name="route" [size]="15" />{{ distance(p.totalDistanceM) }}</span>
              }
              @if (p.vibe) {
                <span class="flex items-center gap-1 text-brand-700"><app-icon [name]="vibeIcon(p.vibe)" [size]="15" />{{ vibeLabel(p.vibe) }}</span>
              }
              @if (p.rainy) {
                <span class="flex items-center gap-1"><app-icon name="umbrella" [size]="15" />Trời mưa</span>
              }
            </p>
            @if (p.note) {
              <p class="whitespace-pre-line text-sm text-slate-600">{{ p.note }}</p>
            }
          </div>
          @if (p.mine) {
            <div class="flex flex-wrap gap-2">
              <select class="min-h-10 rounded-xl border border-brand-200 bg-white px-3 text-sm" [value]="p.status" (change)="setStatus($any($event.target).value)" aria-label="Trạng thái">
                @for (s of statuses; track s.value) {
                  <option [value]="s.value">{{ s.label }}</option>
                }
              </select>
              <button type="button" class="flex min-h-10 items-center gap-1.5 rounded-xl border border-brand-200 bg-white px-3 text-sm text-slate-700 hover:bg-brand-50" (click)="openEdit()">
                <app-icon name="edit" [size]="16" />Sửa
              </button>
              <button type="button" class="flex min-h-10 items-center gap-1.5 rounded-xl border border-brand-200 bg-white px-3 text-sm text-rose-600 hover:bg-rose-50" (click)="confirmDelete.set(true)">
                <app-icon name="trash" [size]="16" />
              </button>
            </div>
          }
        </header>

        @if (p.mine) {
          <div class="flex flex-wrap gap-2">
            <button type="button" class="flex min-h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50" [disabled]="p.stops.length >= 12" (click)="pickerOpen.set(true)">
              <app-icon name="plus" [size]="18" [stroke]="2.4" />Thêm điểm
            </button>
            <button type="button" class="flex min-h-10 items-center gap-2 rounded-xl border border-brand-200 bg-white px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50" [disabled]="!p.stops.length" (click)="shareOpen.set(true)">
              <app-icon name="chat" [size]="18" />Rủ đi
            </button>
            @if (directions(); as url) {
              <a [href]="url" target="_blank" rel="noopener" class="flex min-h-10 items-center gap-2 rounded-xl border border-brand-200 bg-white px-4 text-sm text-slate-700 hover:bg-brand-50">
                <app-icon name="navigate" [size]="18" />Chỉ đường
              </a>
            }
          </div>
        }

        @if (p.stops.length === 0) {
          <div class="rounded-2xl border border-dashed border-brand-200 bg-white p-10 text-center text-sm text-slate-500">
            Chưa có điểm nào. Bấm <strong>Thêm điểm</strong> để chọn quán hoặc chỗ chơi.
          </div>
        } @else {
          <ol class="flex flex-col">
            @for (s of p.stops; track s.id; let i = $index, last = $last) {
              @if (i > 0) {
                <li class="ml-[34px] flex items-center gap-2 border-l-2 border-dashed border-brand-200 py-2 pl-6 text-xs text-slate-500">
                  <app-icon [name]="s.travelMode === 'walk' ? 'user' : 'navigate'" [size]="14" />
                  @if (s.distanceFromPrevM !== null) {
                    {{ distance(s.distanceFromPrevM) }} · {{ s.travelFromPrevMin }} phút {{ s.travelMode === 'walk' ? 'đi bộ' : 'xe máy' }}
                  } @else {
                    Chưa rõ khoảng cách · ước {{ s.travelFromPrevMin }} phút
                  }
                </li>
              }
              <li class="flex gap-3">
                <div class="flex w-[70px] shrink-0 flex-col items-center pt-3 text-center">
                  <span class="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{{ i + 1 }}</span>
                  <span class="mt-1 text-sm font-semibold text-slate-900">{{ s.arrival }}</span>
                  <span class="text-[11px] text-slate-400">đến {{ s.departure }}</span>
                </div>
                <div class="min-w-0 flex-1 rounded-2xl border border-brand-100 bg-white p-3 sm:p-4">
                  <div class="flex gap-3">
                    <div class="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-brand-50 sm:h-20 sm:w-20">
                      @if (s.imageUrl) {
                        <img [src]="s.imageUrl" alt="" class="h-full w-full object-cover" loading="lazy" />
                      } @else {
                        <div class="flex h-full items-center justify-center text-brand-400"><app-icon [name]="icon(s.category)" [size]="24" /></div>
                      }
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="flex items-center gap-1.5 text-xs font-medium text-brand-700"><app-icon [name]="icon(s.category)" [size]="13" />{{ category(s.category) }} · {{ s.districtLabel }}</p>
                      <h3 class="truncate text-base font-bold text-slate-900">{{ s.name }}</h3>
                      <p class="truncate text-xs text-slate-500">{{ s.address || 'Chưa có địa chỉ' }}@if (s.openTime) { · mở {{ s.openTime }}–{{ s.closeTime }}}</p>
                      @if (s.warnings.length) {
                        <div class="mt-1.5 flex flex-wrap gap-1.5">
                          @for (w of s.warnings; track w) {
                            <span class="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" [class]="warningClass(w)">
                              <app-icon [name]="warningMeta(w).tone === 'info' ? 'info' : 'alert'" [size]="12" />{{ warningMeta(w).label }}
                            </span>
                          }
                        </div>
                      }
                    </div>
                  </div>

                  @if (p.mine) {
                    <div class="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs">
                      <label class="flex items-center gap-1 text-slate-500">
                        <app-icon name="clock" [size]="13" />Ở lại
                        <select class="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-slate-800" [value]="s.durationMin" (change)="setDuration(s, +$any($event.target).value)">
                          @for (d of durationsFor(s); track d) {
                            <option [value]="d">{{ d }} phút</option>
                          }
                        </select>
                      </label>
                      <input
                        class="min-w-[140px] flex-1 rounded-md border border-slate-200 px-2 py-1 text-slate-800"
                        placeholder="Ghi chú (đặt bàn, món nên gọi…)"
                        maxlength="500"
                        [value]="s.note"
                        (change)="setNote(s, $any($event.target).value)"
                      />
                      <div class="ml-auto flex items-center gap-1">
                        <button type="button" class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30" [disabled]="i === 0" (click)="move(i, -1)" aria-label="Lên trước">
                          <span class="-rotate-90"><app-icon name="arrowRight" [size]="15" /></span>
                        </button>
                        <button type="button" class="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30" [disabled]="last" (click)="move(i, 1)" aria-label="Xuống sau">
                          <span class="rotate-90"><app-icon name="arrowRight" [size]="15" /></span>
                        </button>
                        <button type="button" class="flex items-center gap-1 rounded-md px-2 py-1.5 font-medium text-brand-700 hover:bg-brand-50" (click)="swap(s)" title="Đổi sang chỗ khác cùng loại">
                          <app-icon name="refresh" [size]="14" />Đổi
                        </button>
                        <button type="button" class="rounded-md p-1.5 text-rose-500 hover:bg-rose-50" (click)="removeStop(s)" aria-label="Bỏ điểm này">
                          <app-icon name="close" [size]="15" />
                        </button>
                      </div>
                    </div>
                  } @else if (s.note) {
                    <p class="mt-2 text-xs text-slate-600">{{ s.note }}</p>
                  }

                  @if (p.mine && p.status === 'done') {
                    <div class="mt-3 rounded-xl bg-emerald-50/60 p-3">
                      <div class="flex items-center gap-1">
                        <span class="mr-1 text-xs font-medium text-slate-600">Chấm điểm</span>
                        @for (n of [1, 2, 3, 4, 5]; track n) {
                          <button type="button" class="text-[#E29A2D]" (click)="rate(s, n)" [attr.aria-label]="n + ' sao'">
                            <app-icon name="star" [size]="18" [filled]="(s.rating ?? 0) >= n" />
                          </button>
                        }
                      </div>
                      <textarea
                        rows="2"
                        maxlength="2000"
                        class="mt-2 w-full rounded-lg border border-emerald-100 bg-white px-2.5 py-1.5 text-sm"
                        placeholder="Kỷ niệm ở đây…"
                        [value]="s.memory"
                        (change)="setMemory(s, $any($event.target).value)"
                      ></textarea>
                    </div>
                  }
                </div>
              </li>
            }
          </ol>

          @if (hasCoordinates()) {
            <app-plan-map [stops]="p.stops" />
          }
        }

        @if (p.mine && p.status === 'done') {
          <section class="flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-white p-4">
            <h2 class="flex items-center gap-2 text-base font-bold text-slate-900"><app-icon name="heart" [size]="18" />Kỷ niệm buổi hẹn</h2>
            <textarea rows="3" maxlength="4000" class="{{ input }}" placeholder="Hôm đó thế nào?" [value]="p.memory" (change)="setPlanMemory($any($event.target).value)"></textarea>
            @if (canEdit() && girlfriends().length) {
              <div class="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-sm">
                <span class="text-slate-600">Lưu các quán và kỷ niệm vào Người yêu:</span>
                <select class="rounded-lg border border-slate-300 bg-white px-2 py-1.5" [value]="girlfriendId()" (change)="girlfriendId.set($any($event.target).value)">
                  <option value="">Chọn người…</option>
                  @for (g of girlfriends(); track g.id) {
                    <option [value]="g.id">{{ g.name }}</option>
                  }
                </select>
                <button type="button" class="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50" [disabled]="!girlfriendId() || busy()" (click)="saveToGirlfriend()">Lưu</button>
              </div>
            }
          </section>
        }
      }
    </div>

    @if (pickerOpen() && plan(); as p) {
      <app-stop-picker
        [initialDistrict]="p.district"
        [districts]="districts()"
        [exclude]="inPlan()"
        (pick)="addStop($event)"
        (cancel)="pickerOpen.set(false)"
      />
    }

    @if (shareOpen()) {
      <app-modal title="Rủ đi" subtitle="Gửi plan vào tin nhắn với người đã match" width="max-w-md" (dismiss)="shareOpen.set(false)">
        @if (matches().length === 0) {
          <p class="py-6 text-center text-sm text-slate-500">Chưa có ai match với bạn. Vào <a routerLink="/dating" class="font-semibold text-brand-700">Tìm đối tượng</a> nhé.</p>
        } @else {
          <ul class="divide-y divide-slate-100">
            @for (m of matches(); track m.id) {
              <li class="flex items-center gap-3 py-2.5">
                @if (m.user.avatarUrl) {
                  <img [src]="m.user.avatarUrl" alt="" class="h-10 w-10 rounded-full object-cover" />
                } @else {
                  <span class="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-500"><app-icon name="user" [size]="18" /></span>
                }
                <span class="flex-1 text-sm font-semibold text-slate-900">{{ m.user.displayName }}, {{ m.user.age }}</span>
                <button type="button" class="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50" [disabled]="busy()" (click)="share(m.id, m.user.displayName)">Gửi</button>
              </li>
            }
          </ul>
        }
        <div modalFooter>
          <button type="button" class="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600" (click)="shareOpen.set(false)">Đóng</button>
        </div>
      </app-modal>
    }

    @if (editOpen() && plan(); as p) {
      <app-modal title="Sửa plan" width="max-w-md" (dismiss)="editOpen.set(false)">
        <div class="space-y-4">
          <label class="block text-sm font-medium text-slate-700">
            Tên plan
            <input class="mt-1.5 {{ input }}" maxlength="120" [value]="form().title" (input)="patchForm({ title: $any($event.target).value })" />
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="block text-sm font-medium text-slate-700">
              Ngày
              <input type="date" class="mt-1.5 {{ input }}" [value]="form().date ?? ''" (input)="patchForm({ date: $any($event.target).value || null })" />
            </label>
            <label class="block text-sm font-medium text-slate-700">
              Bắt đầu
              <input type="time" class="mt-1.5 {{ input }}" [value]="form().startTime" (input)="patchForm({ startTime: $any($event.target).value })" />
            </label>
          </div>
          <label class="block text-sm font-medium text-slate-700">
            Khu vực chính
            <select class="mt-1.5 {{ input }}" [value]="form().district ?? ''" (change)="patchForm({ district: $any($event.target).value || null })">
              <option value="">Chưa chọn</option>
              @for (d of districts(); track d.code) {
                <option [value]="d.code">{{ d.label }}</option>
              }
            </select>
          </label>
          <div>
            <p class="mb-1.5 text-sm font-medium text-slate-700">Kiểu hẹn (dùng khi bấm Đổi)</p>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-full border px-3 py-1 text-xs font-medium" [class]="form().vibe === null ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500'" (click)="patchForm({ vibe: null })">Gì cũng được</button>
              @for (v of vibes; track v.value) {
                <button type="button" class="flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium" [class]="form().vibe === v.value ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500'" (click)="patchForm({ vibe: v.value })">
                  <app-icon [name]="v.icon" [size]="13" />{{ v.label }}
                </button>
              }
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <label class="block text-sm font-medium text-slate-700">
              Ngân sách
              <select class="mt-1.5 {{ input }}" [value]="budgetIndex(form().budget)" (change)="patchForm({ budget: budgets[+$any($event.target).value].value })">
                @for (b of budgets; track $index) {
                  <option [value]="$index">{{ b.label }}</option>
                }
              </select>
            </label>
            <label class="mt-7 flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" class="h-4 w-4 accent-brand-600" [checked]="form().rainy" (change)="patchForm({ rainy: $any($event.target).checked })" />Trời mưa
            </label>
          </div>
          <label class="block text-sm font-medium text-slate-700">
            Ghi chú
            <textarea rows="2" maxlength="2000" class="mt-1.5 {{ input }}" [value]="form().note" (input)="patchForm({ note: $any($event.target).value })"></textarea>
          </label>
        </div>
        <div modalFooter class="flex gap-2">
          <button type="button" class="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600" (click)="editOpen.set(false)">Huỷ</button>
          <button type="button" class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50" [disabled]="!form().title.trim() || busy()" (click)="saveEdit()">Lưu</button>
        </div>
      </app-modal>
    }

    @if (confirmDelete()) {
      <app-confirm-dialog title="Xoá plan này?" message="Plan và mọi điểm trong plan sẽ bị xoá. Tin nhắn đã rủ đi vẫn còn nhưng không mở được plan." confirmLabel="Xoá" (confirm)="remove()" (cancel)="confirmDelete.set(false)" />
    }
  `,
})
export class PlanDetailPage implements OnInit {
  private readonly api = inject(PlanService);
  private readonly catalog = inject(CatalogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly bootstrap = inject(DataBootstrapService);
  private readonly inbox = inject(MatchInboxService);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id')!;

  protected readonly canEdit = inject(AuthService).canEdit;
  protected readonly girlfriends = inject(GirlfriendService).items;
  protected readonly matches = this.inbox.matches;

  protected readonly input = INPUT;
  protected readonly statuses = PLAN_STATUSES;
  protected readonly budgets = PLAN_BUDGETS;
  protected readonly vibes = VIBES;

  protected readonly plan = signal<Plan | null>(null);
  protected readonly gone = signal(false);
  protected readonly districts = signal<DistrictOption[]>([]);
  protected readonly busy = signal(false);
  protected readonly pickerOpen = signal(false);
  protected readonly shareOpen = signal(false);
  protected readonly editOpen = signal(false);
  protected readonly confirmDelete = signal(false);
  protected readonly girlfriendId = signal('');
  protected readonly form = signal({
    title: '',
    date: null as string | null,
    startTime: '18:00',
    district: null as string | null,
    note: '',
    vibe: null as Vibe | null,
    budget: null as number | null,
    rainy: false,
  });

  protected readonly inPlan = computed(() => this.plan()?.stops.map((s) => s.refId) ?? []);
  protected readonly directions = computed(() => directionsUrl(this.plan()?.stops ?? []));
  protected readonly hasCoordinates = computed(() => (this.plan()?.stops ?? []).some((s) => s.lat !== null && s.lng !== null));

  async ngOnInit(): Promise<void> {
    void this.catalog.districts().then((d) => this.districts.set(d));
    try {
      this.plan.set(await this.api.get(this.id));
    } catch (err) {
      if (errorCode(err) === 'NOT_FOUND') this.gone.set(true);
    }
  }

  // ---- Hiển thị ----

  protected statusMeta(s: PlanStatus) {
    return planStatusMeta(s);
  }

  protected icon(category: string) {
    return stopIcon(category);
  }

  protected category(category: string) {
    return stopCategoryLabel(category);
  }

  protected distance(m: number) {
    return distanceText(m);
  }

  protected vibeIcon(v: Vibe) {
    return vibeMeta(v).icon;
  }

  protected vibeLabel(v: Vibe) {
    return vibeMeta(v).label;
  }

  protected warningMeta(w: StopWarning) {
    return STOP_WARNINGS[w];
  }

  protected warningClass(w: StopWarning): string {
    const tone = STOP_WARNINGS[w].tone;
    return tone === 'danger' ? 'bg-rose-50 text-rose-700' : tone === 'warn' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600';
  }

  protected durationsFor(s: PlanStop): number[] {
    return DURATIONS.includes(s.durationMin) ? DURATIONS : [...DURATIONS, s.durationMin].sort((a, b) => a - b);
  }

  protected dateText(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  protected budgetIndex(budget: number | null): number {
    return Math.max(0, this.budgets.findIndex((b) => b.value === budget));
  }

  // ---- Điểm dừng ----

  protected async addStop(e: { kind: StopKind; refId: string }): Promise<void> {
    await this.run(() => this.api.addStop(this.id, e.kind, e.refId));
    this.toast.success('Đã thêm vào plan.');
  }

  protected setDuration(s: PlanStop, durationMin: number): Promise<void> {
    return this.run(() => this.api.updateStop(this.id, s.id, { durationMin }));
  }

  protected setNote(s: PlanStop, note: string): Promise<void> {
    return this.run(() => this.api.updateStop(this.id, s.id, { note }));
  }

  protected rate(s: PlanStop, rating: number): Promise<void> {
    return this.run(() => this.api.updateStop(this.id, s.id, { rating }));
  }

  protected setMemory(s: PlanStop, memory: string): Promise<void> {
    return this.run(() => this.api.updateStop(this.id, s.id, { memory }));
  }

  protected removeStop(s: PlanStop): Promise<void> {
    return this.run(() => this.api.removeStop(this.id, s.id));
  }

  protected move(i: number, delta: -1 | 1): Promise<void> {
    const ids = this.plan()!.stops.map((s) => s.id);
    [ids[i], ids[i + delta]] = [ids[i + delta], ids[i]];
    return this.run(() => this.api.reorder(this.id, ids));
  }

  protected async swap(s: PlanStop): Promise<void> {
    try {
      await this.run(() => this.api.swap(this.id, s.id));
    } catch (err) {
      if (errorCode(err) === 'NO_ALTERNATIVE') this.toast.show(`Không còn ${stopCategoryLabel(s.category).toLowerCase()} nào khác phù hợp để đổi.`, 'info');
    }
  }

  // ---- Plan ----

  protected openEdit(): void {
    const p = this.plan()!;
    this.form.set({
      title: p.title,
      date: p.date,
      startTime: p.startTime,
      district: p.district,
      note: p.note,
      vibe: p.vibe,
      budget: p.budget,
      rainy: p.rainy,
    });
    this.editOpen.set(true);
  }

  protected patchForm(patch: Partial<ReturnType<typeof this.form>>): void {
    this.form.update((f) => ({ ...f, ...patch }));
  }

  protected async saveEdit(): Promise<void> {
    const p = this.plan()!;
    const f = this.form();
    try {
      await this.run(() => this.api.update(this.id, { ...f, title: f.title.trim(), version: p.version }));
      this.editOpen.set(false);
    } catch (err) {
      if (errorCode(err) === 'VERSION_CONFLICT') {
        const current = problemOf(err)?.current as Plan | undefined;
        if (current) this.plan.set(current);
        this.toast.show('Plan vừa được sửa ở nơi khác, đã tải bản mới nhất. Hãy sửa lại.', 'info');
        this.editOpen.set(false);
      }
    }
  }

  protected setStatus(status: PlanStatus): Promise<void> {
    return this.run(() => this.api.setStatus(this.id, status));
  }

  protected async setPlanMemory(memory: string): Promise<void> {
    const p = this.plan()!;
    await this.run(() =>
      this.api.update(this.id, {
        title: p.title,
        date: p.date,
        startTime: p.startTime,
        district: p.district,
        note: p.note,
        memory,
        vibe: p.vibe,
        budget: p.budget,
        rainy: p.rainy,
        version: p.version,
      }),
    );
  }

  protected async remove(): Promise<void> {
    this.confirmDelete.set(false);
    await this.api.remove(this.id);
    this.toast.success('Đã xoá plan.');
    await this.router.navigate(['/plans']);
  }

  protected async share(matchId: string, name: string): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.api.share(this.id, matchId);
      this.shareOpen.set(false);
      this.toast.success(`Đã rủ ${name} đi theo plan này.`);
    } finally {
      this.busy.set(false);
    }
  }

  protected async copy(): Promise<void> {
    const copy = await this.api.copy(this.id);
    this.toast.success('Đã lưu thành plan của bạn.');
    await this.router.navigate(['/plans', copy.id]);
  }

  protected async saveToGirlfriend(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const r = await this.api.saveToGirlfriend(this.id, this.girlfriendId());
      await this.bootstrap.loadAll(); // My place và quán đã đi cùng vừa thay đổi
      this.toast.success(
        `Đã lưu ${r.linked} quán vào Người yêu.` + (r.skipped ? ` ${r.skipped} chỗ chơi không lưu được (Người yêu chỉ gắn quán).` : ''),
      );
    } finally {
      this.busy.set(false);
    }
  }

  /** Gọi API trả về plan mới rồi cập nhật trang */
  private async run(call: () => Promise<Plan>): Promise<void> {
    this.busy.set(true);
    try {
      this.plan.set(await call());
    } finally {
      this.busy.set(false);
    }
  }
}
