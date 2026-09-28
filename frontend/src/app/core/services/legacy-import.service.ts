import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE, errorMessage } from '../api/api';
import { DataBootstrapService } from './data-bootstrap.service';

/** Key localStorage của phiên bản frontend cũ (trước khi có backend). */
export const LEGACY_KEYS = {
  places: 'gfm.places',
  girlfriends: 'gfm.girlfriends',
  placeLinks: 'gfm.placeLinks',
} as const;

/** Mốc thời gian của bộ dữ liệu mẫu cũ: mọi bản ghi còn nguyên mốc này nghĩa là chưa ai sửa gì. */
const OLD_SEED_TIME = '2026-01-01T00:00:00.000Z';
const OLD_SEED_COUNTS = { places: 10, girlfriends: 2, placeLinks: 4 };

export interface LegacyPayload {
  places: unknown[];
  girlfriends: unknown[];
  placeLinks: unknown[];
}

export interface ImportStats {
  places: number;
  girlfriends: number;
  placeLinks: number;
  images: number;
  skipped: number;
  skippedReasons: string[];
}

interface ImportJob {
  id: string;
  status: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED';
  stats: ImportStats | null;
  error: string | null;
}

export type LegacyImportState =
  | { step: 'none' }
  | { step: 'offer'; payload: LegacyPayload }
  | { step: 'running' }
  | { step: 'done'; stats: ImportStats }
  | { step: 'failed'; message: string; payload: LegacyPayload };

/**
 * Đưa dữ liệu localStorage cũ lên tài khoản: phát hiện → hỏi → POST /import/local-storage (202) →
 * hỏi trạng thái mỗi giây tới khi DONE/FAILED. Xong thì đổi tên key thành `*.imported` (giữ lại
 * phòng khi cần, không xoá hẳn) và tải lại dữ liệu.
 */
@Injectable({ providedIn: 'root' })
export class LegacyImportService {
  private readonly http = inject(HttpClient);
  private readonly bootstrap = inject(DataBootstrapService);

  readonly state = signal<LegacyImportState>({ step: 'none' });
  readonly visible = computed(() => this.state().step !== 'none');

  /** Có thể chỉnh trong test để không phải chờ thật. */
  pollIntervalMs = 1000;
  pollTimeoutMs = 5 * 60_000;

  /** Gọi sau khi đăng nhập và tải dữ liệu xong. */
  check(): void {
    if (this.state().step !== 'none') return;
    const payload = readLegacyData(localStorage);
    if (payload) this.state.set({ step: 'offer', payload });
  }

  /** "Để sau": lần mở app tới sẽ hỏi lại. */
  later(): void {
    this.state.set({ step: 'none' });
  }

  /** "Không nhập": không hỏi lại nữa, nhưng vẫn giữ dữ liệu cũ dưới tên khác. */
  dismiss(): void {
    renameLegacyKeys(localStorage, '.skipped');
    this.state.set({ step: 'none' });
  }

  close(): void {
    this.state.set({ step: 'none' });
  }

  async start(payload: LegacyPayload): Promise<void> {
    this.state.set({ step: 'running' });
    try {
      const { jobId } = await firstValueFrom(
        this.http.post<{ jobId: string }>(`${API_BASE}/import/local-storage`, payload),
      );
      const job = await this.waitForJob(jobId);
      if (job.status === 'DONE' && job.stats) {
        renameLegacyKeys(localStorage, '.imported');
        this.state.set({ step: 'done', stats: job.stats });
        await this.bootstrap.loadAll();
      } else {
        this.state.set({ step: 'failed', message: job.error ?? 'Import thất bại.', payload });
      }
    } catch (err) {
      this.state.set({ step: 'failed', message: errorMessage(err), payload });
    }
  }

  private async waitForJob(jobId: string): Promise<ImportJob> {
    const deadline = Date.now() + this.pollTimeoutMs;
    for (;;) {
      const job = await firstValueFrom(
        this.http.get<ImportJob>(`${API_BASE}/import/jobs/${jobId}`),
      );
      if (job.status === 'DONE' || job.status === 'FAILED') return job;
      if (Date.now() > deadline) {
        return {
          ...job,
          status: 'FAILED',
          error: 'Server xử lý quá lâu. Hãy thử lại sau ít phút.',
        };
      }
      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }
  }
}

/**
 * Dữ liệu cũ đáng hỏi người dùng, hoặc null nếu không có gì. Bộ dữ liệu mẫu còn nguyên (chưa ai
 * thêm/sửa/xoá) thì coi như không có, để không hỏi người mới chỉ mở thử app bản cũ.
 */
export function readLegacyData(storage: Storage): LegacyPayload | null {
  const read = (key: string): unknown[] | null => {
    const raw = storage.getItem(key);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };
  const places = read(LEGACY_KEYS.places);
  const girlfriends = read(LEGACY_KEYS.girlfriends);
  const placeLinks = read(LEGACY_KEYS.placeLinks);
  if (!places && !girlfriends && !placeLinks) return null;

  const payload = {
    places: places ?? [],
    girlfriends: girlfriends ?? [],
    placeLinks: placeLinks ?? [],
  };
  if (payload.places.length + payload.girlfriends.length + payload.placeLinks.length === 0)
    return null;
  return isUntouchedSeed(payload) ? null : payload;
}

function isUntouchedSeed(p: LegacyPayload): boolean {
  const sameCounts =
    p.places.length === OLD_SEED_COUNTS.places &&
    p.girlfriends.length === OLD_SEED_COUNTS.girlfriends &&
    p.placeLinks.length === OLD_SEED_COUNTS.placeLinks;
  const untouched = (item: unknown) => {
    const { createdAt, updatedAt } = item as { createdAt?: string; updatedAt?: string };
    return createdAt === OLD_SEED_TIME && (updatedAt === undefined || updatedAt === OLD_SEED_TIME);
  };
  return sameCounts && [...p.places, ...p.girlfriends, ...p.placeLinks].every(untouched);
}

function renameLegacyKeys(storage: Storage, suffix: string): void {
  for (const key of Object.values(LEGACY_KEYS)) {
    const value = storage.getItem(key);
    if (value === null) continue;
    try {
      storage.setItem(key + suffix, value);
    } catch {
      // Hết dung lượng: vẫn xoá key gốc để không hỏi lại mãi
    }
    storage.removeItem(key);
  }
}
