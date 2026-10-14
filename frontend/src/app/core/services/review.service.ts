import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from '../api/api';
import { Review, ReviewPage, ReviewRequest, ReviewSort, ReviewTarget } from '../models/review.model';

/** Đánh giá quán / chỗ chơi: xem công khai; viết, sửa, xoá, "Hữu ích" cần đăng nhập. */
@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE}/reviews`;

  list(target: ReviewTarget, id: string, sort: ReviewSort, page = 0, size = 5): Promise<ReviewPage> {
    const params = new HttpParams().set('target', target).set('id', id).set('sort', sort).set('page', page).set('size', size);
    return firstValueFrom(this.http.get<ReviewPage>(this.base, { params }));
  }

  save(target: ReviewTarget, id: string, req: ReviewRequest): Promise<Review> {
    const params = new HttpParams().set('target', target).set('id', id);
    return firstValueFrom(this.http.put<Review>(`${this.base}/mine`, req, { params }));
  }

  delete(target: ReviewTarget, id: string): Promise<void> {
    const params = new HttpParams().set('target', target).set('id', id);
    return firstValueFrom(this.http.delete<void>(`${this.base}/mine`, { params }));
  }

  helpful(reviewId: string, on: boolean): Promise<{ helpfulCount: number; helpedByMe: boolean }> {
    const url = `${this.base}/${reviewId}/helpful`;
    return firstValueFrom(on ? this.http.post<{ helpfulCount: number; helpedByMe: boolean }>(url, {}) : this.http.delete<{ helpfulCount: number; helpedByMe: boolean }>(url));
  }
}
