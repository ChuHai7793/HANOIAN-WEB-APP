import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from '../api/api';
import { Article, ArticlePage, ArticleRequest, ArticleSummary } from '../models/article.model';

/** Cẩm nang: bài đã xuất bản (công khai) và soạn bài (admin). */
@Injectable({ providedIn: 'root' })
export class ArticleService {
  private readonly http = inject(HttpClient);

  list(page = 0, size = 12): Promise<ArticlePage> {
    const params = new HttpParams().set('page', page).set('size', size);
    return firstValueFrom(this.http.get<ArticlePage>(`${API_BASE}/articles`, { params }));
  }

  bySlug(slug: string): Promise<Article> {
    return firstValueFrom(this.http.get<Article>(`${API_BASE}/articles/${encodeURIComponent(slug)}`));
  }

  adminList(): Promise<ArticleSummary[]> {
    return firstValueFrom(this.http.get<ArticleSummary[]>(`${API_BASE}/admin/articles`));
  }

  adminGet(id: string): Promise<Article> {
    return firstValueFrom(this.http.get<Article>(`${API_BASE}/admin/articles/${id}`));
  }

  create(req: ArticleRequest): Promise<Article> {
    return firstValueFrom(this.http.post<Article>(`${API_BASE}/admin/articles`, req));
  }

  update(id: string, req: ArticleRequest): Promise<Article> {
    return firstValueFrom(this.http.put<Article>(`${API_BASE}/admin/articles/${id}`, req));
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${API_BASE}/admin/articles/${id}`));
  }
}
