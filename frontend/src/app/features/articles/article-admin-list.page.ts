import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArticleSummary, dateText } from '../../core/models/article.model';
import { ArticleService } from '../../core/services/article.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared/ui/icon.component';

/** Quản trị Cẩm nang: mọi bài (nháp + đã xuất bản), viết bài mới, sửa, xoá. */
@Component({
  selector: 'app-article-admin-list-page',
  imports: [RouterLink, IconComponent],
  template: `
    <div class="mx-auto flex max-w-5xl flex-col gap-5 px-4 pb-12 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-extrabold tracking-tight text-slate-900">Bài viết Cẩm nang</h1>
          <p class="text-sm text-slate-500">Bài nháp chỉ admin thấy. Bài đã xuất bản hiện ở <a routerLink="/cam-nang" class="font-semibold text-brand-700 hover:underline">/cam-nang</a> và có trong sitemap.</p>
        </div>
        <a routerLink="/admin/articles/new" class="flex h-10 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
          <app-icon name="plus" [size]="16" [stroke]="2.4" />Viết bài mới
        </a>
      </header>

      @if (items().length) {
        <ul class="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          @for (a of items(); track a.id) {
            <li class="flex items-center gap-4 p-3">
              <div class="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-brand-100">
                @if (a.coverUrl) {
                  <img [src]="a.coverUrl" alt="" class="h-full w-full object-cover" />
                }
              </div>
              <div class="min-w-0 flex-1">
                <a [routerLink]="['/admin/articles', a.id]" class="block truncate font-semibold text-slate-900 hover:text-brand-700">{{ a.title }}</a>
                <p class="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                  @if (a.status === 'published') {
                    <span class="rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">Đã xuất bản</span>
                    <span>{{ date(a.publishedAt) }}</span>
                  } @else {
                    <span class="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600">Nháp</span>
                  }
                  <span>· sửa {{ date(a.updatedAt) }}</span>
                  <span class="truncate">· /cam-nang/{{ a.slug }}</span>
                </p>
              </div>
              @if (a.status === 'published') {
                <a [routerLink]="['/cam-nang', a.slug]" class="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Xem bài" aria-label="Xem bài"><app-icon name="eye" [size]="16" /></a>
              }
              <a [routerLink]="['/admin/articles', a.id]" class="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Sửa" aria-label="Sửa"><app-icon name="edit" [size]="16" /></a>
              <button type="button" class="rounded-lg p-2 text-rose-500 hover:bg-rose-50" [class.font-semibold]="confirmId() === a.id" (click)="remove(a)" [attr.aria-label]="confirmId() === a.id ? 'Xoá thật?' : 'Xoá'">
                @if (confirmId() === a.id) {
                  <span class="text-xs">Xoá thật?</span>
                } @else {
                  <app-icon name="trash" [size]="16" />
                }
              </button>
            </li>
          }
        </ul>
      } @else if (!loading()) {
        <p class="rounded-2xl border border-dashed border-brand-200 bg-white px-6 py-14 text-center text-sm text-slate-500">Chưa có bài nào. Bấm "Viết bài mới" để bắt đầu.</p>
      }
    </div>
  `,
})
export class ArticleAdminListPage implements OnInit {
  private readonly api = inject(ArticleService);
  private readonly toast = inject(ToastService);
  protected readonly items = signal<ArticleSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly confirmId = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      this.items.set(await this.api.adminList());
    } finally {
      this.loading.set(false);
    }
  }

  protected date(iso: string | null): string {
    return dateText(iso);
  }

  /** Bấm 2 lần mới xoá */
  protected async remove(a: ArticleSummary): Promise<void> {
    if (this.confirmId() !== a.id) {
      this.confirmId.set(a.id);
      setTimeout(() => this.confirmId.update((id) => (id === a.id ? null : id)), 4000);
      return;
    }
    await this.api.remove(a.id);
    this.items.update((l) => l.filter((x) => x.id !== a.id));
    this.confirmId.set(null);
    this.toast.success('Đã xoá bài viết.');
  }
}
