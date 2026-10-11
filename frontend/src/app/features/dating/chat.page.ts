import { DatePipe } from '@angular/common';
import { Component, computed, ElementRef, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { errorCode } from '../../core/api/api';
import { ChatMessage, Match, MESSAGE_MAX } from '../../core/models/dating.model';
import { DatingService } from '../../core/services/dating.service';

/** Mỗi 3 giây hỏi tin mới khi đang mở cuộc trò chuyện (tab bị ẩn thì bỏ qua). */
export const POLL_MS = 3000;
const PAGE = 50;

/** Gộp tin mới vào danh sách: bỏ trùng theo id (tin vừa gửi có thể về lại qua lần hỏi định kỳ), cũ trước mới sau. */
export function mergeMessages(list: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(list.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

/**
 * Nhắn tin với một người đã match. Hỏi tin mới định kỳ, đánh dấu đã xem khi có tin người kia gửi,
 * "Xem tin cũ hơn" để cuộn lên. Match bị bỏ / chặn thì báo cuộc trò chuyện không còn.
 */
@Component({
  selector: 'app-chat-page',
  imports: [DatePipe, RouterLink],
  template: `
    <div class="mx-auto flex h-[calc(100dvh-4rem)] max-w-2xl flex-col p-4 sm:p-6 lg:h-dvh">
      <div class="mb-3 flex items-center gap-3 border-b border-slate-200 pb-3">
        <a routerLink="/dating" [queryParams]="{ tab: 'matches' }" class="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="Quay lại">←</a>
        @if (match(); as m) {
          @if (m.user.avatarUrl) {
            <img [src]="m.user.avatarUrl" alt="" class="h-10 w-10 rounded-full object-cover" />
          } @else {
            <div class="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50">👤</div>
          }
          <div class="min-w-0">
            <p class="truncate font-semibold text-slate-900">{{ m.user.displayName }}, {{ m.user.age }}</p>
            <p class="text-xs text-slate-500">Match {{ m.matchedAt | date: 'dd/MM/yyyy' }}</p>
          </div>
        }
      </div>

      @if (gone()) {
        <div class="flex flex-1 flex-col items-center justify-center text-center text-sm text-slate-500">
          <p class="text-3xl">💔</p>
          <p class="mt-2">Cuộc trò chuyện này không còn (đã bỏ match hoặc bị chặn).</p>
          <a routerLink="/dating" [queryParams]="{ tab: 'matches' }" class="mt-3 font-semibold text-brand-700 hover:underline">Về danh sách match</a>
        </div>
      } @else {
        <div #scroller class="flex-1 space-y-2 overflow-y-auto pr-1">
          @if (hasOlder()) {
            <div class="text-center">
              <button type="button" class="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 hover:bg-slate-200" (click)="loadOlder()">Xem tin cũ hơn</button>
            </div>
          }
          @if (loaded() && messages().length === 0) {
            <p class="py-10 text-center text-sm text-slate-500">Hai bạn đã match. Gửi lời chào đầu tiên nhé 👋</p>
          }
          @for (msg of messages(); track msg.id; let i = $index) {
            @if (newDay(i)) {
              <p class="py-2 text-center text-[11px] text-slate-400">{{ msg.createdAt | date: 'EEEE, dd/MM/yyyy' }}</p>
            }
            <div class="flex" [class.justify-end]="msg.mine">
              <div
                class="max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm"
                [class]="msg.mine ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-slate-100 text-slate-800'"
              >
                {{ msg.body }}
                <span class="mt-0.5 block text-right text-[10px]" [class]="msg.mine ? 'text-white/70' : 'text-slate-400'">{{ msg.createdAt | date: 'HH:mm' }}</span>
              </div>
            </div>
          }
          @if (seen()) {
            <p class="text-right text-[11px] text-slate-400">Đã xem</p>
          }
        </div>

        <form class="mt-3 flex items-end gap-2" (submit)="$event.preventDefault(); send()">
          <textarea
            rows="1"
            class="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-2xl border border-slate-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
            placeholder="Nhắn tin…"
            [attr.maxlength]="max"
            [value]="draft()"
            (input)="draft.set($any($event.target).value)"
            (keydown.enter)="onEnter($any($event))"
          ></textarea>
          <button
            type="submit"
            class="rounded-full bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            [disabled]="!draft().trim() || sending()"
          >
            Gửi
          </button>
        </form>
      }
    </div>
  `,
})
export class ChatPage implements OnInit, OnDestroy {
  private readonly dating = inject(DatingService);
  private readonly matchId = inject(ActivatedRoute).snapshot.paramMap.get('id')!;
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private timer: ReturnType<typeof setInterval> | undefined;
  private polling = false;

  protected readonly max = MESSAGE_MAX;
  protected readonly match = signal<Match | null>(null);
  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly loaded = signal(false);
  protected readonly hasOlder = signal(false);
  protected readonly gone = signal(false);
  protected readonly draft = signal('');
  protected readonly sending = signal(false);

  /** Tin cuối là của mình và người kia đã xem */
  protected readonly seen = computed(() => {
    const last = this.messages().at(-1);
    return !!last?.mine && !!last.readAt;
  });

  async ngOnInit(): Promise<void> {
    const [matches, first] = await Promise.all([this.dating.matches(), this.guard(() => this.dating.messages(this.matchId))]);
    this.match.set(matches.find((m) => m.id === this.matchId) ?? null);
    if (!first) return;
    this.messages.set(first);
    this.hasOlder.set(first.length >= PAGE);
    this.loaded.set(true);
    await this.markReadIfNeeded(first);
    this.scrollToBottom();
    this.timer = setInterval(() => void this.poll(), POLL_MS);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  protected async poll(): Promise<void> {
    if (this.polling || this.gone() || (typeof document !== 'undefined' && document.hidden)) return;
    this.polling = true;
    try {
      // Lấy cả tin mới lẫn trạng thái "đã xem" của tin mình: hỏi lại từ tin cuối người kia chưa xem
      const after = this.oldestUnseenMine() ?? this.messages().at(-1)?.createdAt;
      const fresh = await this.guard(() => this.dating.messages(this.matchId, after ? { after } : {}));
      if (!fresh?.length) return;
      const before = this.messages().length;
      this.messages.update((list) => mergeMessages(list, fresh));
      await this.markReadIfNeeded(fresh);
      if (this.messages().length > before) this.scrollToBottom();
    } finally {
      this.polling = false;
    }
  }

  protected async loadOlder(): Promise<void> {
    const oldest = this.messages()[0];
    if (!oldest) return;
    const older = await this.guard(() => this.dating.messages(this.matchId, { before: oldest.createdAt }));
    if (!older) return;
    this.hasOlder.set(older.length >= PAGE);
    this.messages.update((list) => mergeMessages(list, older));
  }

  protected async send(): Promise<void> {
    const body = this.draft().trim();
    if (!body || this.sending()) return;
    this.sending.set(true);
    try {
      const sent = await this.dating.sendMessage(this.matchId, body);
      this.draft.set('');
      this.messages.update((list) => mergeMessages(list, [sent]));
      this.scrollToBottom();
    } catch (err) {
      if (errorCode(err) === 'NOT_FOUND') this.stop();
      // lỗi khác (bị khoá, mất mạng…) errorInterceptor đã báo; giữ nguyên nội dung đang gõ
    } finally {
      this.sending.set(false);
    }
  }

  /** Enter để gửi, Shift+Enter xuống dòng. */
  protected onEnter(event: KeyboardEvent): void {
    if (event.shiftKey || event.isComposing) return;
    event.preventDefault();
    void this.send();
  }

  protected newDay(i: number): boolean {
    const list = this.messages();
    return i === 0 || list[i].createdAt.slice(0, 10) !== list[i - 1].createdAt.slice(0, 10);
  }

  /** Thời điểm ngay trước tin đầu tiên của mình mà người kia chưa xem (để lần hỏi sau cập nhật "Đã xem"). */
  private oldestUnseenMine(): string | undefined {
    const list = this.messages();
    const i = list.findIndex((m) => m.mine && !m.readAt);
    if (i < 0) return undefined;
    return i === 0 ? new Date(new Date(list[0].createdAt).getTime() - 1).toISOString() : list[i - 1].createdAt;
  }

  private async markReadIfNeeded(list: ChatMessage[]): Promise<void> {
    if (list.some((m) => !m.mine && !m.readAt)) await this.dating.markRead(this.matchId).catch(() => undefined);
  }

  /** Chạy một lần đọc; match không còn (404) thì dừng và báo. */
  private async guard<T>(load: () => Promise<T>): Promise<T | null> {
    try {
      return await load();
    } catch (err) {
      if (errorCode(err) === 'NOT_FOUND') this.stop();
      return null;
    }
  }

  private stop(): void {
    this.gone.set(true);
    clearInterval(this.timer);
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.scroller()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}
