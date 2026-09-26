import { HttpClient } from '@angular/common/http';
import { computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE, errorCode, problemOf } from '../api/api';

export interface Entity {
  id: string;
  version: number;
}

/** Field do server quản lý, không gửi lên. */
const READ_ONLY = ['id', 'version', 'createdAt', 'updatedAt'] as const;

/**
 * Kho CRUD dùng chung cho mọi thực thể: state giữ trong signal (component chỉ việc đọc),
 * mọi thay đổi gọi REST API. Sửa/xoá là optimistic: cập nhật giao diện ngay, lỗi thì hoàn tác.
 */
export abstract class CrudStore<T extends Entity> {
  protected readonly http = inject(HttpClient);
  private readonly state = signal<T[]>([]);

  readonly items = this.state.asReadonly();
  readonly count = computed(() => this.state().length);
  readonly loaded = signal(false);

  /** @param path đường dẫn sau /api/v1, ví dụ 'places' */
  protected constructor(private readonly path: string) {}

  protected get url(): string {
    return `${API_BASE}/${this.path}`;
  }

  /** Dữ liệu server → model frontend (ví dụ ngày null → ''). */
  protected fromApi(raw: T): T {
    return raw;
  }

  /** Model frontend → body gửi server (ví dụ ngày '' → null). */
  protected toApi(data: Record<string, unknown>): Record<string, unknown> {
    return data;
  }

  async load(): Promise<void> {
    const rows = await firstValueFrom(this.http.get<T[]>(this.url));
    this.state.set(rows.map((r) => this.fromApi(r)));
    this.loaded.set(true);
  }

  byId(id: string): T | undefined {
    return this.state().find((item) => item.id === id);
  }

  async create(data: Omit<T, 'id'>): Promise<T> {
    const raw = await firstValueFrom(this.http.post<T>(this.url, this.body(data)));
    const created = this.fromApi(raw);
    this.state.update((list) => [...list, created]);
    return created;
  }

  /**
   * PATCH kèm version đang giữ. Server báo VERSION_CONFLICT thì thay bằng bản mới nhất server
   * gửi kèm (`current`); lỗi khác thì hoàn tác. Lỗi luôn được ném lại để form giữ nguyên.
   */
  async update(id: string, changes: Partial<T>): Promise<T> {
    const current = this.byId(id);
    if (!current) throw new Error(`Không tìm thấy bản ghi ${id}`);

    this.replace({ ...current, ...changes, id, version: current.version });
    try {
      const raw = await firstValueFrom(
        this.http.patch<T>(`${this.url}/${id}`, { ...this.body(changes), version: current.version }),
      );
      const saved = this.fromApi(raw);
      this.replace(saved);
      return saved;
    } catch (err) {
      const problem = problemOf(err);
      if (problem?.code === 'VERSION_CONFLICT' && problem.current) {
        this.replace(this.fromApi(problem.current as T));
      } else if (problem?.code === 'NOT_FOUND') {
        this.dropLocal((item) => item.id === id);
      } else {
        this.replace(current);
      }
      throw err;
    }
  }

  async remove(id: string): Promise<void> {
    const current = this.byId(id);
    this.dropLocal((item) => item.id === id);
    try {
      await firstValueFrom(this.http.delete<void>(`${this.url}/${id}`));
    } catch (err) {
      // Đã bị xoá ở thiết bị khác: kết quả cuối cùng vẫn đúng
      if (errorCode(err) === 'NOT_FOUND') return;
      if (current) this.state.update((list) => [...list, current]);
      throw err;
    }
  }

  /** Chỉ xoá trong state, không gọi API (dùng khi server đã tự cascade). */
  dropLocal(predicate: (item: T) => boolean): void {
    this.state.update((list) => list.filter((item) => !predicate(item)));
  }

  clear(): void {
    this.state.set([]);
    this.loaded.set(false);
  }

  private replace(item: T): void {
    this.state.update((list) => list.map((x) => (x.id === item.id ? item : x)));
  }

  private body(data: object): Record<string, unknown> {
    const copy: Record<string, unknown> = { ...data };
    for (const key of READ_ONLY) delete copy[key];
    return this.toApi(copy);
  }
}
