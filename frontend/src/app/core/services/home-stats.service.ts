import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from '../api/api';

/** Con số thật cho trang chủ (công khai); ratingAvg null = chưa có đánh giá */
export interface HomeStats {
  places: number;
  spots: number;
  reviews: number;
  ratingAvg: number | null;
  plans: number;
}

@Injectable({ providedIn: 'root' })
export class HomeStatsService {
  private readonly http = inject(HttpClient);

  get(): Promise<HomeStats> {
    return firstValueFrom(this.http.get<HomeStats>(`${API_BASE}/public/stats`));
  }
}
