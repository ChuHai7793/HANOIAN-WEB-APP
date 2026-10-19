import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, ElementRef, inject, input, OnInit, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { errorMessage } from '../../core/api/api';
import { ArticleRequest, ArticleStatus } from '../../core/models/article.model';
import { CatalogItem } from '../../core/models/catalog.model';
import { SpotItem } from '../../core/models/spot.model';
import { ArticleService } from '../../core/services/article.service';
import { CatalogService } from '../../core/services/catalog.service';
import { SpotService } from '../../core/services/spot.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared/ui/icon.component';
import { ImagePickerComponent } from '../../shared/ui/image-picker.component';
import { ArticleBodyComponent } from './article-body.component';

/** "Cafe Cuối Ngõ!" → "cafe-cuoi-ngo" (giống backend, để gợi ý đường dẫn khi gõ tiêu đề) */
function slugify(value: string): string {
  return value
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}

/**
 * Soạn bài Cẩm nang (admin): tiêu đề, đường dẫn, mô tả ngắn (hiện trên Google), ảnh bìa, nội dung Markdown có thanh
 * công cụ, chèn thẻ quán / chỗ chơi, xem trước, lưu nháp hoặc xuất bản. /admin/articles/new hoặc /admin/articles/:id.
 */
@Component({
  selector: 'app-article-editor-page',
  imports: [RouterLink, IconComponent, ImagePickerComponent, ArticleBodyComponent],
  template: `
    <div class="mx-auto flex max-w-7xl flex-col gap-5 px-4 pb-12 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <header class="flex flex-wrap items-center gap-3">
        <a routerLink="/admin/articles" class="text-sm text-slate-500 hover:text-brand-700">← Bài viết</a>
        <h1 class="mr-auto text-xl font-extrabold tracking-tight text-slate-900">{{ id() ? 'Sửa bài' : 'Viết bài mới' }}</h1>
        @if (savedSlug() && status() === 'published') {
          <a [routerLink]="['/cam-nang', savedSlug()]" class="flex h-9 items-center gap-1.5 rounded-xl border border-brand-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-brand-50"><app-icon name="eye" [size]="15" />Xem bài</a>
        }
        <button type="button" class="h-9 rounded-xl border border-brand-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-brand-50 disabled:opacity-60" [disabled]="busy()" (click)="save('draft')">Lưu nháp</button>
        <button type="button" class="h-9 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60" [disabled]="busy()" (click)="save('published')">
          {{ status() === 'published' ? 'Cập nhật bài' : 'Xuất bản' }}
        </button>
      </header>
      @if (error()) {
        <p class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{{ error() }}</p>
      }

      <div class="grid gap-6 lg:grid-cols-2">
        <!-- Soạn -->
        <div class="flex flex-col gap-4">
          <label class="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            Tiêu đề <span class="font-normal text-slate-400">(có từ khoá chính, vd. "quán cafe hẹn hò Hà Nội")</span>
            <input class="rounded-lg border border-slate-300 px-3 py-2 text-base font-semibold" maxlength="160" [value]="title()" (input)="onTitle($any($event.target).value)" placeholder="15 quán cafe yên tĩnh để hẹn hò ở Hà Nội" />
          </label>
          <label class="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            Đường dẫn
            <span class="flex items-center rounded-lg border border-slate-300 bg-slate-50 text-sm">
              <span class="pl-3 text-slate-400">/cam-nang/</span>
              <input class="min-w-0 flex-1 bg-transparent px-1 py-2 outline-none" maxlength="90" [value]="slug()" (input)="slugTouched.set(true); slug.set(slugify($any($event.target).value))" />
            </span>
          </label>
          <label class="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            Mô tả ngắn <span class="font-normal text-slate-400">(hiện dưới tiêu đề trên Google, ~150 ký tự)</span>
            <textarea class="rounded-lg border border-slate-300 px-3 py-2 text-sm" rows="2" maxlength="300" [value]="excerpt()" (input)="excerpt.set($any($event.target).value)"></textarea>
            <span class="text-right text-xs text-slate-400">{{ excerpt().length }}/300</span>
          </label>
          <app-image-picker label="Ảnh bìa" [value]="coverUrl()" (valueChange)="coverUrl.set($event)" [maxSize]="1600" purpose="article" [nameHint]="title()" />

          <div class="flex flex-col gap-1.5">
            <span class="text-sm font-medium text-slate-700">Nội dung</span>
            <div class="flex flex-wrap gap-1 rounded-t-lg border border-b-0 border-slate-300 bg-slate-50 p-1.5">
              <button type="button" class="rounded px-2 py-1 text-sm font-bold hover:bg-white" title="Tiêu đề mục" (click)="insertLine('## ')">H2</button>
              <button type="button" class="rounded px-2 py-1 text-sm font-semibold hover:bg-white" title="Tiêu đề nhỏ" (click)="insertLine('### ')">H3</button>
              <button type="button" class="rounded px-2 py-1 text-sm font-bold hover:bg-white" title="In đậm" (click)="wrap('**')">B</button>
              <button type="button" class="rounded px-2 py-1 text-sm italic hover:bg-white" title="In nghiêng" (click)="wrap('_')">I</button>
              <button type="button" class="rounded px-2 py-1 text-sm hover:bg-white" title="Danh sách" (click)="insertLine('- ')">• Danh sách</button>
              <button type="button" class="rounded px-2 py-1 text-sm hover:bg-white" title="Trích dẫn" (click)="insertLine('> ')">“ Trích</button>
              <button type="button" class="rounded px-2 py-1 text-sm hover:bg-white" title="Link" (click)="wrap('[', '](https://)')">Link</button>
              <span class="mx-1 w-px bg-slate-300"></span>
              <button type="button" class="flex items-center gap-1 rounded bg-brand-100 px-2 py-1 text-sm font-semibold text-brand-700 hover:bg-brand-200" (click)="openPicker('place')">
                <app-icon name="cup" [size]="14" />Chèn quán
              </button>
              <button type="button" class="flex items-center gap-1 rounded bg-brand-100 px-2 py-1 text-sm font-semibold text-brand-700 hover:bg-brand-200" (click)="openPicker('spot')">
                <app-icon name="gate" [size]="14" />Chèn chỗ chơi
              </button>
            </div>
            @if (picker(); as kind) {
              <div class="flex flex-col gap-2 border-x border-slate-300 bg-white p-2">
                <input class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" [placeholder]="kind === 'place' ? 'Tìm quán…' : 'Tìm chỗ chơi…'" (input)="pickerQuery.set($any($event.target).value)" />
                <div class="max-h-48 overflow-y-auto">
                  @for (o of pickerOptions(); track o.slug) {
                    <button type="button" class="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-brand-50" (click)="insertEmbed(kind, o.slug)">{{ o.name }} <span class="text-slate-400">· {{ o.districtLabel }}</span></button>
                  } @empty {
                    <p class="px-2 py-1.5 text-sm text-slate-400">Không có kết quả.</p>
                  }
                </div>
              </div>
            }
            <textarea
              #bodyArea
              class="min-h-[420px] rounded-b-lg border border-slate-300 px-3 py-2 font-mono text-[13px] leading-relaxed"
              [value]="body()"
              (input)="body.set($any($event.target).value)"
              placeholder="## Mở đầu&#10;Viết vài câu giới thiệu…&#10;&#10;## 1. Cafe Cuối Ngõ&#10;Nhận xét của bạn về quán…&#10;[[quan:cafe-cuoi-ngo]]"
            ></textarea>
            <p class="text-xs text-slate-500">Markdown: <code>## Tiêu đề</code>, <code>**đậm**</code>, <code>- danh sách</code>. Thẻ quán là một dòng riêng dạng <code>[[quan:đường-dẫn]]</code>.</p>
          </div>
        </div>

        <!-- Xem trước -->
        <div class="lg:sticky lg:top-4 lg:self-start">
          <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Xem trước</p>
          <div class="max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6">
            <h1 class="text-3xl font-extrabold leading-tight tracking-tight text-slate-900">{{ title() || 'Tiêu đề bài viết' }}</h1>
            @if (excerpt()) {
              <p class="mt-3 text-lg leading-relaxed text-slate-600">{{ excerpt() }}</p>
            }
            @if (coverUrl()) {
              <img [src]="coverUrl()" alt="" class="my-5 aspect-[16/9] w-full rounded-2xl object-cover" />
            }
            <app-article-body [body]="body()" />
          </div>
          <!-- Xem trước kết quả Google -->
          <div class="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <p class="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Trên Google</p>
            <p class="truncate text-[13px] text-slate-500">…/cam-nang/{{ slug() || 'duong-dan' }}</p>
            <p class="truncate text-lg text-[#1a0dab]">{{ title() || 'Tiêu đề bài viết' }} · HANOIVIBE</p>
            <p class="line-clamp-2 text-sm text-slate-600">{{ excerpt() || 'Mô tả ngắn sẽ hiện ở đây.' }}</p>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class ArticleEditorPage implements OnInit {
  private readonly api = inject(ArticleService);
  private readonly catalog = inject(CatalogService);
  private readonly spots = inject(SpotService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly bodyArea = viewChild<ElementRef<HTMLTextAreaElement>>('bodyArea');

  /** Có khi sửa bài (/admin/articles/:id) */
  readonly id = input<string>();

  protected readonly slugify = slugify;
  protected readonly title = signal('');
  protected readonly slug = signal('');
  protected readonly slugTouched = signal(false);
  protected readonly excerpt = signal('');
  protected readonly coverUrl = signal('');
  protected readonly body = signal('');
  protected readonly status = signal<ArticleStatus>('draft');
  protected readonly savedSlug = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected readonly picker = signal<'place' | 'spot' | null>(null);
  protected readonly pickerQuery = signal('');
  private readonly places = signal<CatalogItem[]>([]);
  private readonly spotList = signal<SpotItem[]>([]);
  protected readonly pickerOptions = computed(() => {
    const q = slugify(this.pickerQuery());
    const list = this.picker() === 'place' ? this.places() : this.spotList();
    return list.filter((o) => !q || o.slug.includes(q)).slice(0, 50);
  });

  async ngOnInit(): Promise<void> {
    const id = this.id();
    if (!id || id === 'new') return;
    const a = await this.api.adminGet(id);
    this.title.set(a.title);
    this.slug.set(a.slug);
    this.slugTouched.set(true);
    this.excerpt.set(a.excerpt);
    this.coverUrl.set(a.coverUrl ?? '');
    this.body.set(a.body);
    this.status.set(a.status);
    this.savedSlug.set(a.slug);
  }

  protected onTitle(value: string): void {
    this.title.set(value);
    // Bài mới: đường dẫn đi theo tiêu đề cho tới khi admin tự sửa đường dẫn
    if (!this.slugTouched()) this.slug.set(slugify(value));
  }

  protected async openPicker(kind: 'place' | 'spot'): Promise<void> {
    this.picker.set(this.picker() === kind ? null : kind);
    this.pickerQuery.set('');
    if (kind === 'place' && !this.places().length) this.places.set((await this.catalog.search({ size: 100 })).items);
    if (kind === 'spot' && !this.spotList().length) this.spotList.set((await this.spots.search({ size: 100 })).items);
  }

  protected insertEmbed(kind: 'place' | 'spot', slug: string): void {
    this.insertLine(`[[${kind === 'place' ? 'quan' : 'cho-choi'}:${slug}]]`, true);
    this.picker.set(null);
  }

  /** Chèn ở đầu dòng hiện tại (hoặc thành một dòng riêng) */
  protected insertLine(prefix: string, ownLine = false): void {
    const el = this.bodyArea()?.nativeElement;
    const text = this.body();
    const pos = el ? el.selectionStart : text.length;
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    const next = ownLine
      ? text.slice(0, pos) + (pos > 0 && text[pos - 1] !== '\n' ? '\n' : '') + prefix + '\n' + text.slice(pos)
      : text.slice(0, lineStart) + prefix + text.slice(lineStart);
    this.body.set(next);
    queueMicrotask(() => el?.focus());
  }

  /** Bọc đoạn đang chọn: **đậm**, _nghiêng_, [link](url) */
  protected wrap(before: string, after = before): void {
    const el = this.bodyArea()?.nativeElement;
    const text = this.body();
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const selected = text.slice(start, end) || 'chữ';
    this.body.set(text.slice(0, start) + before + selected + after + text.slice(end));
    queueMicrotask(() => el?.focus());
  }

  protected async save(status: ArticleStatus): Promise<void> {
    if (!this.title().trim()) return this.error.set('Nhập tiêu đề.');
    this.busy.set(true);
    this.error.set('');
    const req: ArticleRequest = {
      title: this.title().trim(),
      slug: this.slug(),
      excerpt: this.excerpt().trim(),
      coverUrl: this.coverUrl(),
      body: this.body(),
      status,
    };
    try {
      const id = this.id();
      const saved = id && id !== 'new' ? await this.api.update(id, req) : await this.api.create(req);
      this.status.set(saved.status);
      this.slug.set(saved.slug);
      this.savedSlug.set(saved.slug);
      this.slugTouched.set(true);
      this.toast.success(status === 'published' ? 'Đã xuất bản bài viết.' : 'Đã lưu nháp.');
      if (!id || id === 'new') await this.router.navigate(['/admin/articles', saved.id], { replaceUrl: true });
    } catch (err) {
      this.error.set(err instanceof HttpErrorResponse ? errorMessage(err) : 'Không lưu được.');
    } finally {
      this.busy.set(false);
    }
  }
}
