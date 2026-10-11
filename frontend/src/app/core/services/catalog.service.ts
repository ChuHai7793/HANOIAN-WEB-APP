import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from '../api/api';
import { CatalogPage, DistrictOption, ImportRun } from '../models/catalog.model';
import { PlaceType } from '../models/place.model';

export interface CatalogQuery {
  q?: string;
  type?: PlaceType | '';
  district?: string;
  page?: number;
  size?: number;
}

/** "Khám phá quán" (mọi người đọc) và nhập từ OpenStreetMap (chỉ admin). */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);

  search(query: CatalogQuery): Promise<CatalogPage> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    }
    return firstValueFrom(this.http.get<CatalogPage>(`${API_BASE}/catalog`, { params }));
  }

  districts(): Promise<DistrictOption[]> {
    return firstValueFrom(this.http.get<DistrictOption[]>(`${API_BASE}/catalog/districts`));
  }

  startImport(districts: string[], types: PlaceType[]): Promise<ImportRun> {
    return firstValueFrom(
      this.http.post<ImportRun>(`${API_BASE}/admin/catalog/import`, { districts, types }),
    );
  }

  runs(): Promise<ImportRun[]> {
    return firstValueFrom(this.http.get<ImportRun[]>(`${API_BASE}/admin/catalog/runs`));
  }
}
