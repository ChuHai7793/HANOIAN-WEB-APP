import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { errorCode } from '../../core/api/api';
import {
  Candidate,
  DatingSettings,
  DatingSettingsRequest,
  Match,
} from '../../core/models/dating.model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatingService } from '../../core/services/dating.service';
import { MatchInboxService } from '../../core/services/match-inbox.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { ToastService } from '../../core/services/toast.service';
import { SwipeCardComponent } from './swipe-card.component';
import { ReportDialogComponent, ReportInput } from './report-dialog.component';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog.component';
import { PlaceType, priceLabel } from '../../core/models/place.model';
import { IconComponent } from '../../shared/ui/icon.component';
import { AuthService } from '../../core/auth/auth.service';

type Tab = 'swipe' | 'matches';

/**
 * "Tìm đối tượng" kiểu Tinder: bật mục (cần ảnh, đủ 18 tuổi), quẹt thẻ, hai bên cùng thích thì "It's a
 * match!", tab Match liệt kê những người đã match.
 */
@Component({
  selector: 'app-dating-page',
  imports: [DatePipe, RouterLink, SwipeCardComponent, ReportDialogComponent, ConfirmDialogComponent, IconComponent],
  template: `
    <div class="relative flex flex-col gap-4 px-4 pb-8 pt-4 sm:px-6 lg:px-8 lg:pt-5">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col gap-1.5">
          <h1 class="text-2xl font-extrabold tracking-tight text-slate-900">Tìm đối tượng</h1>
          <p class="hidden text-[13px] text-slate-500 sm:block">Quẹt phải để thích, quẹt trái để bỏ qua. Hai bên cùng thích là match.</p>
        </div>
        @if (settings()?.enabled) {
          <div class="flex flex-wrap items-center gap-3">
            <button
              type="button"
              class="flex min-h-10 items-center gap-2 rounded-xl border border-brand-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-brand-50"
              (click)="openFilters()"
            >
              <app-icon name="filter" [size]="18" />
              Bộ lọc
            </button>
            <div role="tablist" aria-label="Chế độ" class="flex gap-1 rounded-[14px] bg-[#EFEAFC] p-1">
              <button
                type="button"
                role="tab"
                [attr.aria-selected]="tab() === 'swipe'"
                class="min-h-10 rounded-[10px] px-[18px] text-sm"
                [class]="tab() === 'swipe' ? 'bg-white font-bold text-brand-800 shadow-[0_1px_3px_rgba(48,30,110,0.12)]' : 'font-medium text-slate-600'"
                (click)="tab.set('swipe')"
              >
                Quẹt
              </button>
              <button
                type="button"
                role="tab"
                [attr.aria-selected]="tab() === 'matches'"
                class="min-h-10 rounded-[10px] px-[18px] text-sm"
                [class]="tab() === 'matches' ? 'bg-white font-bold text-brand-800 shadow-[0_1px_3px_rgba(48,30,110,0.12)]' : 'font-medium text-slate-600'"
                (click)="openMatches()"
              >
                Match
              </button>
            </div>
          </div>
        }
      </header>

      @if (!settings()) {
        <p class="text-sm text-slate-500">Đang tải…</p>
      } @else if (settings()!.banned) {
        <div class="mx-auto max-w-md rounded-[28px] border border-rose-200 bg-rose-50 p-8 text-center text-sm text-rose-800">
          <p class="flex justify-center text-rose-500"><app-icon name="ban" [size]="36" /></p>
          <p class="mt-2 font-semibold">Bạn đã bị quản trị viên khoá khỏi Tìm đối tượng.</p>
          <p class="mt-1">Hồ sơ của bạn không hiện với người khác. Liên hệ quản trị viên nếu có nhầm lẫn.</p>
        </div>
      } @else if (!settings()!.enabled) {
        <!-- Chưa bật: giới thiệu, điều kiện, thông báo quyền của admin -->
        <div class="mx-auto flex max-w-md flex-col items-center rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-[0_2px_4px_rgba(48,30,110,0.05),0_24px_48px_rgba(48,30,110,0.10)]">
          <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
            <app-icon name="heart" [size]="32" [filled]="true" />
          </div>
          <h2 class="mt-4 text-xl font-extrabold text-slate-900">Bật Tìm đối tượng</h2>
          <p class="mt-2 text-sm leading-relaxed text-slate-600">
            Hồ sơ của bạn (ảnh, tên, tuổi, thành phố, giới thiệu) sẽ hiện cho người dùng khác cùng bật mục
            này. Chỉ người từ 18 tuổi.
          </p>
          @if (settings()!.missing.length) {
            <p class="mt-4 w-full rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Cần bổ sung trong
              <a routerLink="/profile" class="font-semibold underline">Hồ sơ của tôi</a>:
              {{ settings()!.missing.join(', ') }}.
            </p>
          }
          <p class="mt-4 w-full rounded-xl bg-brand-50 px-3 py-2 text-xs text-slate-600">
            Quán trong My place được dùng để tìm người hợp gu. Người khác chỉ thấy những quán
            <b>cả hai</b> cùng lưu.
          </p>
          <p class="mt-2 w-full rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Quản trị viên có thể xem hồ sơ và hoạt động của bạn trong mục này (ai bạn đã thích, các match, tin nhắn).
          </p>
          <button
            type="button"
            class="mt-5 min-h-11 w-full rounded-[14px] bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50"
            [disabled]="settings()!.missing.length > 0 || busy()"
            (click)="enable()"
          >
            Bật và bắt đầu quẹt
          </button>
        </div>
      } @else if (tab() === 'swipe') {
        <div class="flex flex-wrap items-start justify-center gap-6">
          <!-- Cột thẻ -->
          <div class="flex w-full max-w-[400px] flex-[1_1_360px] flex-col items-stretch gap-3">
            <div class="relative">
              @if (deck().length > 1) {
                <!-- Thẻ kế tiếp nằm phía sau -->
                <div class="absolute inset-0 translate-y-3 scale-[0.96] rounded-[28px] border border-slate-200 bg-white opacity-70"></div>
              }
              @if (deck()[0]; as top) {
                <!-- @for theo userId: mỗi người một thẻ mới (trạng thái kéo không dính sang người sau) -->
                @for (c of [top]; track c.userId) {
                  <app-swipe-card
                    #card
                    class="relative"
                    [candidate]="c"
                    [canSuperLike]="superLeft() > 0"
                    (swiped)="onSwiped(c, $event)"
                    (superSwiped)="onSwiped(c, true, true)"
                  />
                }
              } @else {
                <div class="flex h-[min(460px,calc(100dvh-220px))] flex-col items-center justify-center gap-2 rounded-[28px] border-2 border-dashed border-brand-300 bg-white text-center text-slate-500">
                  <p class="text-brand-400"><app-icon name="moon" [size]="36" /></p>
                  <p class="text-sm">{{ loading() ? 'Đang tìm người…' : 'Hết người để quẹt rồi. Quay lại sau nhé!' }}</p>
                </div>
              }
            </div>

            <div class="flex items-center justify-center gap-4">
              <button
                type="button"
                aria-label="Hoàn tác"
                title="Hoàn tác"
                class="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-brand-600 shadow-[0_6px_16px_rgba(48,30,110,0.08)] transition hover:scale-105 disabled:opacity-40"
                [disabled]="busy()"
                (click)="undo()"
              >
                <app-icon name="undo" [size]="18" [stroke]="2.2" />
              </button>
              <button
                type="button"
                aria-label="Bỏ qua"
                title="Bỏ qua"
                class="flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-[0_8px_20px_rgba(48,30,110,0.10)] transition hover:scale-105 disabled:opacity-40"
                [disabled]="!deck().length || busy()"
                (click)="card()?.fling(false)"
              >
                <app-icon name="close" [size]="24" [stroke]="2.6" />
              </button>
              <button
                type="button"
                aria-label="Siêu thích"
                [title]="superLeft() > 0 ? 'Siêu thích (còn ' + superLeft() + ' lượt hôm nay)' : 'Hết lượt siêu thích hôm nay'"
                class="relative flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-[#2F80D9] shadow-[0_6px_16px_rgba(48,30,110,0.08)] transition hover:scale-105 disabled:opacity-40"
                [disabled]="!deck().length || busy() || superLeft() === 0"
                (click)="card()?.flingUp()"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2l3 6.3 6.9.9-5 4.8 1.2 6.8L12 17.6 5.9 20.8l1.2-6.8-5-4.8 6.9-.9z" />
                </svg>
                @if (superLeft() > 0) {
                  <span class="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2F80D9] px-1 text-[11px] font-bold text-white">
                    {{ superLeft() }}
                  </span>
                }
              </button>
              <button
                type="button"
                aria-label="Thích"
                title="Thích"
                class="flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-[0_10px_24px_rgba(109,79,214,0.35)] transition hover:scale-105 disabled:opacity-40"
                [disabled]="!deck().length || busy()"
                (click)="card()?.fling(true)"
              >
                <app-icon name="heart" [size]="24" [filled]="true" />
              </button>
            </div>
            @if (deck()[0]; as top) {
              <button
                type="button"
                class="flex min-h-8 items-center gap-1.5 self-center px-3 text-xs text-slate-500 hover:text-rose-600"
                (click)="reporting.set({ userId: top.userId, name: top.displayName })"
              >
                <app-icon name="flag" [size]="14" />
                Báo cáo / chặn {{ top.displayName }}
              </button>
            }
          </div>

          <!-- Panel bên -->
          <aside class="flex w-full max-w-[320px] flex-[1_1_260px] flex-col gap-4">
            <section class="flex flex-col gap-3 rounded-[20px] border border-slate-200 bg-white p-4">
              <div class="flex items-center justify-between">
                <h3 class="text-base font-bold text-slate-900">Match gần đây</h3>
                <button type="button" class="min-h-9 px-2 text-[13px] font-semibold text-brand-700 hover:text-brand-900" (click)="openMatches()">
                  Xem tất cả
                </button>
              </div>
              @if (matches().length === 0) {
                <p class="text-[13px] text-slate-500">Chưa có match nào. Quẹt thêm nhé!</p>
              } @else {
                <div class="flex flex-wrap gap-3">
                  @for (m of recentMatches(); track m.id) {
                    <a [routerLink]="['/dating/matches', m.id]" class="flex w-16 flex-col items-center gap-1.5">
                      @if (m.user.avatarUrl) {
                        <img [src]="m.user.avatarUrl" alt="" class="h-12 w-12 rounded-full border-2 border-brand-600 object-cover" />
                      } @else {
                        <span class="flex h-12 w-12 items-center justify-center rounded-full border-2 border-brand-600 bg-brand-200 font-bold text-brand-800">
                          {{ initials(m.user.displayName) }}
                        </span>
                      }
                      <span class="w-full truncate text-center text-xs text-slate-700">{{ m.user.displayName }}</span>
                    </a>
                  }
                </div>
              }
            </section>

            <section class="flex flex-col gap-3 rounded-[20px] border border-slate-200 bg-white p-4">
              @if (deck()[0]?.sharedPlaces?.length) {
                <h3 class="text-base font-bold text-slate-900">Gợi ý điểm hẹn với {{ deck()[0].displayName }}</h3>
                @for (sp of deck()[0].sharedPlaces.slice(0, 2); track sp.catalogId) {
                  <a
                    routerLink="/explore"
                    [queryParams]="{ q: sp.name }"
                    class="flex items-center gap-3 rounded-[14px] bg-slate-50 p-2.5 text-slate-900 hover:bg-brand-50"
                  >
                    <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EFEAFC] text-brand-600">
                      <app-icon name="pin" [size]="22" />
                    </span>
                    <span class="flex min-w-0 flex-col gap-0.5">
                      <span class="truncate text-sm font-semibold">{{ sp.name }}</span>
                      <span class="text-xs text-slate-500">{{ typeLabel[sp.type] }} · {{ sp.district }} · {{ price(sp.priceRange) }}</span>
                    </span>
                  </a>
                }
              } @else {
              <h3 class="text-base font-bold text-slate-900">Gợi ý điểm hẹn</h3>
              <a routerLink="/explore" class="flex items-center gap-3 rounded-[14px] bg-slate-50 p-2.5 text-slate-900 hover:bg-brand-50">
                <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EFEAFC] text-brand-600">
                  <app-icon name="cup" [size]="22" />
                </span>
                <span class="flex min-w-0 flex-col gap-0.5">
                  <span class="text-sm font-semibold">Khám phá quán</span>
                  <span class="text-xs text-slate-500">Cafe, bar, quán ăn ở Hà Nội</span>
                </span>
              </a>
              <a routerLink="/spots" class="flex items-center gap-3 rounded-[14px] bg-slate-50 p-2.5 text-slate-900 hover:bg-brand-50">
                <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EFEAFC] text-brand-600">
                  <app-icon name="gate" [size]="22" />
                </span>
                <span class="flex min-w-0 flex-col gap-0.5">
                  <span class="text-sm font-semibold">Tìm chỗ chơi</span>
                  <span class="text-xs text-slate-500">Workshop, bảo tàng, dạo phố…</span>
                </span>
              </a>
              }
            </section>

            <section class="flex flex-col gap-1 rounded-[20px] bg-brand-100 px-4 py-3">
              <span class="text-[13px] text-slate-600">Hôm nay bạn đã thích</span>
              <span class="text-lg font-extrabold text-brand-800">{{ likedToday() }} người</span>
              <span class="text-xs text-slate-600">Lưu thêm quán để nhận gợi ý chuẩn gu hơn.</span>
            </section>
          </aside>
        </div>
      } @else {
        <!-- Tab Match -->
        @if (matches().length === 0) {
          <div class="rounded-[20px] border border-dashed border-brand-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
            Chưa có match nào. Quẹt thêm nhé!
          </div>
        } @else {
          <div class="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            @for (m of matches(); track m.id) {
              <article class="flex flex-col overflow-hidden rounded-[20px] border border-slate-200 bg-white">
                <a [routerLink]="['/dating/matches', m.id]" class="relative flex h-40 items-center justify-center bg-[#EFEAFC] text-brand-400">
                  @if (m.user.avatarUrl) {
                    <img [src]="m.user.avatarUrl" alt="" class="h-full w-full object-cover" loading="lazy" />
                  } @else {
                    <app-icon name="user" [size]="64" [stroke]="1.2" />
                  }
                  @if (m.unread > 0) {
                    <span class="absolute right-3 top-3 rounded-full bg-[#C2335F] px-2 py-0.5 text-xs font-bold text-white">{{ m.unread }} mới</span>
                  }
                </a>
                <div class="flex flex-col gap-2 p-4">
                  <span class="text-[17px] font-bold text-slate-900">{{ m.user.displayName }}, {{ m.user.age }}</span>
                  <span class="text-[13px] text-slate-500">
                    Match {{ m.matchedAt | date: 'dd/MM/yyyy' }}{{ m.user.sharedPlaces.length ? ' · Cùng lưu ' + m.user.sharedPlaces[0].name : (m.user.city ? ' · ' + m.user.city : '') }}
                  </span>
                  <p class="truncate text-[13px]" [class]="m.unread > 0 ? 'font-semibold text-slate-900' : 'text-slate-500'">
                    @if (m.lastMessage; as last) {
                      {{ last.mine ? 'Bạn: ' : '' }}{{ last.body }}
                    } @else {
                      Chưa nhắn tin
                    }
                  </p>
                  <a
                    [routerLink]="['/dating/matches', m.id]"
                    class="flex min-h-10 items-center justify-center gap-1.5 rounded-[10px] bg-brand-600 text-[13px] font-semibold text-white hover:bg-brand-700"
                  >
                    <app-icon name="chat" [size]="15" />Nhắn tin
                  </a>
                  <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    <button type="button" class="text-slate-500 hover:text-slate-800" (click)="pending.set({ kind: 'unmatch', match: m })">Bỏ match</button>
                    <button type="button" class="text-slate-500 hover:text-slate-800" (click)="pending.set({ kind: 'block', match: m })">Chặn</button>
                    <button type="button" class="text-slate-500 hover:text-rose-600" (click)="reporting.set({ userId: m.user.userId, name: m.user.displayName })">Báo cáo</button>
                  </div>
                </div>
              </article>
            }
          </div>
        }
      }
    </div>

    @if (reporting(); as target) {
      <app-report-dialog [name]="target.name" (send)="sendReport(target.userId, $event)" (cancel)="reporting.set(null)" />
    }

    @if (pending(); as p) {
      <app-confirm-dialog
        [title]="p.kind === 'unmatch' ? 'Bỏ match?' : 'Chặn ' + p.match.user.displayName + '?'"
        [message]="p.kind === 'unmatch'
          ? 'Hai bạn sẽ không còn trong danh sách match của nhau và không hiện lại với nhau.'
          : 'Hai bạn sẽ không còn thấy nhau trong Tìm đối tượng, match cũng bị xoá.'"
        [confirmLabel]="p.kind === 'unmatch' ? 'Bỏ match' : 'Chặn'"
        (confirm)="confirmPending()"
        (cancel)="pending.set(null)"
      />
    }

    @if (filters(); as f) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4" (click)="filters.set(null)">
        <div class="w-full max-w-sm rounded-[24px] bg-white p-6 shadow-xl" (click)="$event.stopPropagation()">
          <h2 class="mb-4 text-lg font-extrabold text-slate-900">Bộ lọc</h2>
          <label class="mb-1.5 block text-sm font-medium text-slate-700">Muốn gặp</label>
          <select
            class="mb-4 min-h-10 w-full rounded-xl border border-brand-200 bg-white px-3 text-sm"
            [value]="f.interestedIn"
            (change)="filters.set({ ...f, interestedIn: $any($event.target).value })"
          >
            <option value="all">Tất cả</option>
            <option value="female">Nữ</option>
            <option value="male">Nam</option>
          </select>
          <label class="mb-1.5 block text-sm font-medium text-slate-700">Tuổi</label>
          <div class="mb-4 flex items-center gap-2">
            <input
              type="number" min="18" max="99"
              class="min-h-10 w-20 rounded-xl border border-brand-200 px-3 text-sm"
              [value]="f.ageMin"
              (input)="filters.set({ ...f, ageMin: +$any($event.target).value })"
            />
            <span class="text-slate-400">–</span>
            <input
              type="number" min="18" max="99"
              class="min-h-10 w-20 rounded-xl border border-brand-200 px-3 text-sm"
              [value]="f.ageMax"
              (input)="filters.set({ ...f, ageMax: +$any($event.target).value })"
            />
          </div>
          <label class="mb-5 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              class="h-4 w-4 accent-brand-600"
              [checked]="f.sameCityOnly"
              (change)="filters.set({ ...f, sameCityOnly: $any($event.target).checked })"
            />
            Chỉ người cùng thành phố với tôi
          </label>
          @if (filterError()) {
            <p class="mb-3 text-xs text-rose-600">{{ filterError() }}</p>
          }
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" class="text-xs font-medium text-rose-600 hover:underline" (click)="disable()">
              Tắt Tìm đối tượng
            </button>
            <span class="flex-1"></span>
            <button type="button" class="min-h-10 rounded-[10px] border border-brand-200 px-4 text-sm text-slate-700" (click)="filters.set(null)">Huỷ</button>
            <button type="button" class="min-h-10 rounded-[10px] bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700" (click)="saveFilters()">Lưu</button>
          </div>
        </div>
      </div>
    }

    @if (justMatched(); as m) {
      <div role="dialog" aria-label="Hai bạn đã match" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-6">
        <div class="flex w-full max-w-[420px] flex-col items-center gap-4 rounded-[28px] bg-white p-8 text-center">
          <div class="flex items-center">
            @if (me()?.avatarUrl) {
              <img [src]="me()!.avatarUrl" alt="" class="h-[72px] w-[72px] rounded-full border-[3px] border-white object-cover" />
            } @else {
              <span class="flex h-[72px] w-[72px] items-center justify-center rounded-full border-[3px] border-white bg-brand-200 text-xl font-extrabold text-brand-800">
                {{ initials(me()?.displayName ?? '') }}
              </span>
            }
            <span class="z-10 -mx-2.5 flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-white bg-[#E5487A] text-white">
              <app-icon name="heart" [size]="18" [filled]="true" />
            </span>
            @if (m.user.avatarUrl) {
              <img [src]="m.user.avatarUrl" alt="" class="h-[72px] w-[72px] rounded-full border-[3px] border-white object-cover" />
            } @else {
              <span class="flex h-[72px] w-[72px] items-center justify-center rounded-full border-[3px] border-white bg-brand-100 text-xl font-extrabold text-brand-800">
                {{ initials(m.user.displayName) }}
              </span>
            }
          </div>
          <h2 class="text-[22px] font-extrabold text-brand-800">Hai bạn đã match!</h2>
          <p class="text-sm leading-normal text-slate-600">
            @if (m.user.sharedPlaces.length) {
              Bạn và {{ m.user.displayName }} cùng lưu <b class="text-slate-900">{{ m.user.sharedPlaces[0].name }}</b>. Hẹn nhau ở đó nhé?
            } @else {
              Bạn và <b class="text-slate-900">{{ m.user.displayName }}</b> đã thích nhau. Nhắn tin rủ đi hẹn nhé?
            }
          </p>
          <button type="button" class="min-h-11 w-full rounded-[14px] bg-brand-600 text-sm font-bold text-white hover:bg-brand-700" (click)="chatWith(m)">
            Nhắn tin ngay
          </button>
          <button type="button" class="min-h-10 w-full rounded-[14px] border border-brand-200 bg-white text-sm font-semibold text-slate-700 hover:bg-brand-50" (click)="justMatched.set(null)">
            Tiếp tục quẹt
          </button>
        </div>
      </div>
    }
  `,
})
export class DatingPage implements OnInit {
  private readonly dating = inject(DatingService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly inbox = inject(MatchInboxService);

  constructor() {
    // Người kia vừa thích lại mình: báo ngay
    inject(RealtimeService)
      .events.pipe(takeUntilDestroyed())
      .subscribe((e) => {
        if (e.type === 'match') this.toast.success(`Bạn và ${e.data.user.displayName} vừa match! Vào tab Match để nhắn tin.`);
        if (e.type === 'super_like') {
          this.toast.success('Có người vừa siêu thích bạn! Họ sẽ hiện đầu tiên khi bạn quẹt.');
          void this.loadDeck();
        }
      });
  }

  protected readonly card = viewChild<SwipeCardComponent>('card');
  protected readonly tab = signal<Tab>('swipe');
  protected readonly settings = signal<DatingSettings | null>(null);
  protected readonly deck = signal<Candidate[]>([]);
  /** Danh sách match dùng chung, tự cập nhật khi có tin / match mới */
  protected readonly matches = this.inbox.matches;
  /** Panel "Match gần đây": 4 người đầu danh sách */
  protected readonly recentMatches = computed(() => this.matches().slice(0, 4));
  /** Người đang đăng nhập: ảnh của mình trong popup match */
  protected readonly me = inject(AuthService).user;
  /** Hôm nay (giờ Việt Nam): số người đã thích, lượt siêu thích còn lại */
  protected readonly likedToday = signal(0);
  protected readonly superLeft = signal(0);
  protected readonly typeLabel: Record<PlaceType, string> = { cafe: 'Cafe', bar: 'Bar', restaurant: 'Quán ăn' };
  protected readonly price = priceLabel;
  protected readonly justMatched = signal<Match | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  /** Bộ lọc đang sửa (null = đóng hộp) */
  protected readonly filters = signal<DatingSettingsRequest | null>(null);
  protected readonly filterError = signal('');
  /** Người đang được báo cáo (null = đóng hộp) */
  protected readonly reporting = signal<{ userId: string; name: string } | null>(null);
  /** Bỏ match hoặc chặn đang chờ xác nhận */
  protected readonly pending = signal<{ kind: 'unmatch' | 'block'; match: Match } | null>(null);

  async ngOnInit(): Promise<void> {
    const s = await this.dating.settings();
    this.settings.set(s);
    // Quay lại từ trang nhắn tin: mở thẳng tab Match
    if (this.route.snapshot.queryParamMap.get('tab') === 'matches') await this.openMatches();
    if (s.enabled) await Promise.all([this.loadDeck(), this.loadToday()]);
  }

  private async loadToday(): Promise<void> {
    const t = await this.dating.today();
    this.likedToday.set(t.liked);
    this.superLeft.set(t.superLikesLeft);
  }

  /** "Minh Trang" → "MT" */
  protected initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  protected chatWith(m: Match): void {
    this.justMatched.set(null);
    void this.router.navigate(['/dating/matches', m.id]);
  }

  protected async enable(): Promise<void> {
    const s = this.settings();
    if (!s) return;
    this.busy.set(true);
    try {
      this.settings.set(
        await this.dating.saveSettings({
          enabled: true,
          interestedIn: s.interestedIn,
          ageMin: s.ageMin,
          ageMax: s.ageMax,
          sameCityOnly: s.sameCityOnly,
        }),
      );
      await Promise.all([this.loadDeck(), this.loadToday()]);
    } finally {
      this.busy.set(false);
    }
  }

  protected async sendReport(userId: string, input: ReportInput): Promise<void> {
    this.reporting.set(null);
    await this.dating.report(userId, input.reason, input.note, input.block);
    // Chặn thì người đó biến khỏi thẻ và danh sách match
    if (input.block) this.removePerson(userId);
    this.toast.success(input.block ? 'Đã gửi báo cáo và chặn người này.' : 'Đã gửi báo cáo tới quản trị viên.');
  }

  protected async confirmPending(): Promise<void> {
    const p = this.pending();
    if (!p) return;
    this.pending.set(null);
    if (p.kind === 'unmatch') {
      await this.dating.unmatch(p.match.id);
      this.toast.success(`Đã bỏ match với ${p.match.user.displayName}.`);
    } else {
      await this.dating.block(p.match.user.userId);
      this.toast.success(`Đã chặn ${p.match.user.displayName}.`);
    }
    this.removePerson(p.match.user.userId);
  }

  private removePerson(userId: string): void {
    this.deck.update((list) => list.filter((c) => c.userId !== userId));
    this.inbox.removeUser(userId);
  }

  protected openFilters(): void {
    const s = this.settings();
    if (!s) return;
    this.filterError.set('');
    this.filters.set({
      enabled: s.enabled,
      interestedIn: s.interestedIn,
      ageMin: s.ageMin,
      ageMax: s.ageMax,
      sameCityOnly: s.sameCityOnly,
    });
  }

  /** Lưu bộ lọc rồi lấy lại chồng thẻ theo bộ lọc mới */
  protected async saveFilters(): Promise<void> {
    const f = this.filters();
    if (!f) return;
    if (f.ageMin < 18 || f.ageMax > 99 || f.ageMin > f.ageMax) {
      this.filterError.set('Tuổi từ 18 đến 99, tuổi nhỏ nhất không lớn hơn tuổi lớn nhất.');
      return;
    }
    this.settings.set(await this.dating.saveSettings(f));
    this.filters.set(null);
    this.deck.set([]);
    await this.loadDeck();
  }

  /** Ẩn hồ sơ khỏi mục này; quay về màn hình giới thiệu */
  protected async disable(): Promise<void> {
    const f = this.filters();
    if (!f) return;
    this.settings.set(await this.dating.saveSettings({ ...f, enabled: false }));
    this.filters.set(null);
    this.deck.set([]);
    this.tab.set('swipe');
    this.toast.success('Đã tắt Tìm đối tượng. Hồ sơ của bạn không còn hiện cho người khác.');
  }

  protected async openMatches(): Promise<void> {
    this.tab.set('matches');
    await this.inbox.refresh();
  }

  /** Thẻ đã bay ra: bỏ khỏi chồng thẻ ngay, gọi API sau (lỗi thì báo) */
  protected async onSwiped(c: Candidate, liked: boolean, superLike = false): Promise<void> {
    this.deck.update((list) => list.filter((x) => x.userId !== c.userId));
    try {
      const res = await this.dating.swipe(c.userId, liked, superLike);
      if (liked) this.likedToday.update((n) => n + 1);
      if (superLike) this.superLeft.update((n) => Math.max(0, n - 1));
      if (res.matched && res.match) this.justMatched.set(res.match);
    } catch (err) {
      if (errorCode(err) === 'SUPER_LIKE_LIMIT') {
        // Hết lượt (vd. đã dùng ở tab khác): đưa thẻ lại để quẹt thường
        this.superLeft.set(0);
        this.deck.update((list) => [c, ...list]);
        this.toast.error('Bạn đã dùng hết lượt siêu thích hôm nay.');
        return;
      }
      // ALREADY_SWIPED: đã quẹt ở tab khác, bỏ qua; lỗi khác errorInterceptor đã báo
      if (errorCode(err) !== 'ALREADY_SWIPED') return;
    }
    if (this.deck().length < 2) await this.loadDeck();
  }

  protected async undo(): Promise<void> {
    this.busy.set(true);
    try {
      const { restored } = await this.dating.undo();
      this.deck.update((list) => [restored, ...list.filter((x) => x.userId !== restored.userId)]);
      // Hoàn tác hoàn lại lượt thích / siêu thích: lấy lại số từ server
      await this.loadToday();
    } catch (err) {
      if (errorCode(err) === 'NOT_FOUND') this.toast.error('Không còn lượt quẹt nào để hoàn tác.');
    } finally {
      this.busy.set(false);
    }
  }

  /** Lấy thêm thẻ, giữ thẻ đang hiện ở đầu */
  private async loadDeck(): Promise<void> {
    this.loading.set(true);
    try {
      const fresh = await this.dating.deck();
      this.deck.update((list) => [...list, ...fresh.filter((f) => !list.some((x) => x.userId === f.userId))]);
    } finally {
      this.loading.set(false);
    }
  }
}
