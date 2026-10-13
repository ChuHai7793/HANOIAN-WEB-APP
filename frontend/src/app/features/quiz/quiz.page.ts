import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { photosOf } from '../../core/models/place.model';
import { Vibe, vibeMeta } from '../../core/models/vibe.model';
import { AuthService } from '../../core/auth/auth.service';
import { CatalogService } from '../../core/services/catalog.service';
import { DateVibeService } from '../../core/services/date-vibe.service';
import { SpotService } from '../../core/services/spot.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { AutoplanDialogComponent } from '../plans/autoplan-dialog.component';

interface Question {
  text: string;
  options: { text: string; vibe: Vibe }[];
}

/** 6 câu, mỗi lựa chọn nghiêng về một kiểu hẹn; thứ tự lựa chọn đổi giữa các câu để không đoán được */
export const QUESTIONS: Question[] = [
  {
    text: 'Tối thứ 7 lý tưởng của bạn là…',
    options: [
      { text: 'Cafe yên tĩnh, ngồi nói chuyện cả tối', vibe: 'chill' },
      { text: 'Đi chơi, vận động, thử trò gì đó mới', vibe: 'active' },
      { text: 'Bữa tối nến, ngắm thành phố về đêm', vibe: 'romantic' },
    ],
  },
  {
    text: 'Buổi hẹn đầu tiên, bạn chọn…',
    options: [
      { text: 'Workshop làm nến thơm cho hai người', vibe: 'romantic' },
      { text: 'Cafe sách, nhạc nhẹ', vibe: 'chill' },
      { text: 'Bowling hoặc board game', vibe: 'active' },
    ],
  },
  {
    text: 'Món quà bạn thích nhận nhất',
    options: [
      { text: 'Vé concert, một trải nghiệm mới', vibe: 'active' },
      { text: 'Thư tay kèm một bó hoa', vibe: 'romantic' },
      { text: 'Một cuốn sách hay', vibe: 'chill' },
    ],
  },
  {
    text: 'Nhạc nền cho buổi hẹn',
    options: [
      { text: 'Acoustic nhẹ nhàng', vibe: 'chill' },
      { text: 'Jazz, piano', vibe: 'romantic' },
      { text: 'Nhạc sôi động', vibe: 'active' },
    ],
  },
  {
    text: 'Trời đẹp, bạn rủ người ấy…',
    options: [
      { text: 'Đạp xe quanh Hồ Tây', vibe: 'active' },
      { text: 'Dạo bộ quanh Hồ Gươm', vibe: 'chill' },
      { text: 'Ngắm hoàng hôn trên rooftop', vibe: 'romantic' },
    ],
  },
  {
    text: 'Điều làm một buổi hẹn đáng nhớ',
    options: [
      { text: 'Khoảnh khắc lãng mạn bất ngờ', vibe: 'romantic' },
      { text: 'Cười thật nhiều, nhiều trải nghiệm mới', vibe: 'active' },
      { text: 'Trò chuyện thoải mái, không vội', vibe: 'chill' },
    ],
  },
];

export const RESULTS: Record<Vibe, { title: string; text: string }> = {
  chill: {
    title: 'Chill: thong thả, sâu lắng',
    text: 'Bạn thích không gian yên tĩnh, những câu chuyện dài và nhịp hẹn hò không vội. Một quán cafe đẹp, một vòng dạo hồ là đủ cho một buổi tối trọn vẹn.',
  },
  active: {
    title: 'Năng động: thích khám phá',
    text: 'Với bạn, hẹn hò là cùng nhau trải nghiệm: trò chơi, vận động, chợ đêm, những nơi chưa từng đến. Càng nhiều tiếng cười càng tốt.',
  },
  romantic: {
    title: 'Lãng mạn: tinh tế, giàu cảm xúc',
    text: 'Bạn để ý từng chi tiết: ánh đèn, âm nhạc, một bất ngờ nhỏ. Bữa tối đẹp, một workshop cho hai người hay rooftop lúc hoàng hôn là gu của bạn.',
  },
};

/** Kiểu hẹn được chọn nhiều nhất; hoà thì lấy kiểu của câu trả lời sau cùng trong số các kiểu hoà. */
export function quizResult(answers: Vibe[]): Vibe {
  const count: Record<Vibe, number> = { chill: 0, active: 0, romantic: 0 };
  for (const a of answers) count[a]++;
  const max = Math.max(...Object.values(count));
  const tied = (Object.keys(count) as Vibe[]).filter((v) => count[v] === max);
  return [...answers].reverse().find((a) => tied.includes(a)) ?? tied[0];
}

interface Pick {
  name: string;
  sub: string;
  image: string | null;
  link: string;
}

/**
 * Quiz "Gu hẹn hò" (khách cũng làm được): 6 câu → chill / năng động / lãng mạn. Kết quả lưu lại (máy hoặc
 * tài khoản) làm kiểu hẹn mặc định cho Autoplan; gợi ý quán, chỗ chơi hợp gu; chia sẻ bằng link ?r=<kiểu>.
 */
@Component({
  selector: 'app-quiz-page',
  imports: [RouterLink, IconComponent, AutoplanDialogComponent],
  template: `
    <div class="mx-auto flex max-w-2xl flex-col gap-5 px-4 pb-10 pt-4 sm:px-6 lg:pt-6">
      @if (result(); as r) {
        <section class="flex flex-col items-center gap-3 rounded-3xl bg-gradient-to-br from-brand-600 to-brand-500 px-6 py-8 text-center text-white">
          <span class="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20"><app-icon [name]="meta(r).icon" [size]="34" /></span>
          <p class="text-sm opacity-90">Gu hẹn hò của {{ shared() ? 'người ấy' : 'bạn' }}</p>
          <h1 class="text-2xl font-extrabold">{{ results[r].title }}</h1>
          <p class="max-w-md text-sm leading-relaxed opacity-95">{{ results[r].text }}</p>
          <div class="mt-2 flex flex-wrap justify-center gap-2">
            <button type="button" class="flex min-h-10 items-center gap-1.5 rounded-xl bg-white px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50" (click)="autoplanOpen.set(true)">
              <app-icon name="shuffle" [size]="16" />Autoplan theo gu này
            </button>
            <button type="button" class="flex min-h-10 items-center gap-1.5 rounded-xl border border-white/60 px-4 text-sm font-semibold text-white hover:bg-white/10" (click)="shareResult(r)">
              <app-icon name="arrowRight" [size]="16" />Chia sẻ kết quả
            </button>
          </div>
        </section>

        @if (picks().length) {
          <section class="flex flex-col gap-2">
            <h2 class="text-base font-bold text-slate-900">Hợp gu {{ meta(r).label }}</h2>
            <div class="grid gap-3 sm:grid-cols-2">
              @for (p of picks(); track p.link + p.name) {
                <a [routerLink]="p.link" class="flex items-center gap-3 rounded-xl border border-brand-100 bg-white p-3 hover:border-brand-300">
                  <div class="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-brand-50">
                    @if (p.image) {
                      <img [src]="p.image" alt="" class="h-full w-full object-cover" loading="lazy" />
                    } @else {
                      <div class="flex h-full items-center justify-center text-brand-400"><app-icon [name]="meta(r).icon" [size]="20" /></div>
                    }
                  </div>
                  <div class="min-w-0">
                    <p class="truncate text-sm font-semibold text-slate-900">{{ p.name }}</p>
                    <p class="truncate text-xs text-slate-500">{{ p.sub }}</p>
                  </div>
                </a>
              }
            </div>
          </section>
        }

        <div class="flex flex-wrap items-center justify-center gap-3 text-sm">
          <button type="button" class="font-medium text-slate-600 hover:text-slate-900" (click)="restart()">
            {{ shared() ? 'Làm quiz của bạn' : 'Làm lại quiz' }}
          </button>
          @if (!loggedIn()) {
            <span class="text-slate-300">·</span>
            <a routerLink="/register" [queryParams]="{ returnUrl: '/quiz' }" class="font-semibold text-brand-700 hover:underline">Tạo tài khoản để lưu gu & tìm người hợp gu</a>
          }
        </div>
      } @else {
        <header class="flex flex-col gap-1">
          <h1 class="text-2xl font-extrabold tracking-tight text-slate-900">Gu hẹn hò của bạn là gì?</h1>
          <p class="text-[13px] text-slate-500">6 câu hỏi, chưa tới 1 phút. Kết quả giúp app gợi ý chỗ hẹn hợp gu.</p>
        </header>
        <div class="h-1.5 overflow-hidden rounded-full bg-brand-100">
          <div class="h-full rounded-full bg-brand-600 transition-all" [style.width.%]="(step() / questions.length) * 100"></div>
        </div>
        @if (current(); as q) {
          <section class="flex flex-col gap-3">
            <p class="text-xs font-medium text-brand-600">Câu {{ step() + 1 }} / {{ questions.length }}</p>
            <h2 class="text-lg font-bold text-slate-900">{{ q.text }}</h2>
            @for (o of q.options; track o.text) {
              <button
                type="button"
                class="rounded-2xl border border-brand-200 bg-white px-4 py-3.5 text-left text-[15px] text-slate-800 transition hover:border-brand-500 hover:bg-brand-50"
                (click)="answer(o.vibe)"
              >
                {{ o.text }}
              </button>
            }
            @if (step() > 0) {
              <button type="button" class="w-fit text-sm text-slate-500 hover:text-slate-800" (click)="back()">← Câu trước</button>
            }
          </section>
        }
      }
    </div>

    @if (autoplanOpen()) {
      <app-autoplan-dialog (closed)="autoplanOpen.set(false)" />
    }
  `,
})
export class QuizPage implements OnInit {
  private readonly dateVibe = inject(DateVibeService);
  private readonly catalog = inject(CatalogService);
  private readonly spots = inject(SpotService);
  private readonly toast = inject(ToastService);
  protected readonly loggedIn = inject(AuthService).isLoggedIn;

  /** ?r=<kiểu>: xem kết quả người khác chia sẻ */
  readonly r = input<string | undefined>();

  protected readonly questions = QUESTIONS;
  protected readonly results = RESULTS;
  protected readonly answers = signal<Vibe[]>([]);
  protected readonly step = computed(() => this.answers().length);
  protected readonly current = computed(() => this.questions[this.step()] ?? null);
  protected readonly result = signal<Vibe | null>(null);
  protected readonly shared = signal(false);
  protected readonly picks = signal<Pick[]>([]);
  protected readonly autoplanOpen = signal(false);

  ngOnInit(): void {
    const r = this.r();
    if (r === 'chill' || r === 'active' || r === 'romantic') {
      this.shared.set(true);
      void this.show(r);
    } else if (this.dateVibe.vibe()) {
      void this.show(this.dateVibe.vibe()!);
    }
  }

  protected meta(v: Vibe) {
    return vibeMeta(v);
  }

  protected async answer(v: Vibe): Promise<void> {
    this.answers.update((a) => [...a, v]);
    if (this.answers().length === this.questions.length) {
      const r = quizResult(this.answers());
      await this.dateVibe.save(r);
      this.shared.set(false);
      await this.show(r);
    }
  }

  protected back(): void {
    this.answers.update((a) => a.slice(0, -1));
  }

  protected restart(): void {
    this.answers.set([]);
    this.result.set(null);
    this.shared.set(false);
  }

  protected async shareResult(v: Vibe): Promise<void> {
    const url = `${location.origin}/quiz?r=${v}`;
    try {
      await navigator.clipboard.writeText(url);
      this.toast.success('Đã sao chép link kết quả.');
    } catch {
      this.toast.show(url, 'info', 10000);
    }
  }

  private async show(v: Vibe): Promise<void> {
    this.result.set(v);
    this.picks.set([]);
    try {
      const [places, spots] = await Promise.all([this.catalog.search({ size: 60 }), this.spots.search({ size: 60 })]);
      const placePicks = places.items
        .filter((p) => p.vibes.includes(v))
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 3)
        .map((p) => ({ name: p.name, sub: p.districtLabel, image: photosOf(p)[0] ?? null, link: '/explore' }));
      const spotPicks = spots.items
        .filter((s) => s.vibes.includes(v))
        .slice(0, 3)
        .map((s) => ({ name: s.name, sub: s.districtLabel, image: photosOf(s)[0] ?? null, link: '/spots' }));
      this.picks.set([...spotPicks, ...placePicks]);
    } catch {
      // không có gợi ý cũng không sao
    }
  }
}
