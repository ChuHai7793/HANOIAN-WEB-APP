import { HttpClient, HttpContext } from '@angular/common/http';
import { computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE, errorCode, problemOf } from '../api/api';
import { IDEMPOTENCY_KEY, SILENT_CODES } from '../api/http-context';
import { ConflictService } from './conflict.service';

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
  private readonly conflicts = inject(ConflictService);
  private readonly state = signal<T[]>([]);
  /** Body → Idempotency-Key của lần tạo chưa thành công, để bấm "Lưu" lại vẫn dùng key cũ. */
  private readonly pendingCreates = new Map<string, string>();

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

  /**
   * Gửi lại đúng dữ liệu cũ sau khi lỗi (mạng chập chờn, server đã tạo nhưng response bị mất)
   * thì dùng lại Idempotency-Key cũ: server trả bản đã tạo thay vì tạo bản thứ hai.
   */
  async create(data: Omit<T, 'id'>): Promise<T> {
    const body = this.body(data);
    const fingerprint = JSON.stringify(body);
    const key = this.pendingCreates.get(fingerprint) ?? crypto.randomUUID();
    this.pendingCreates.set(fingerprint, key);

    const raw = await firstValueFrom(
      this.http.post<T>(this.url, body, { context: new HttpContext().set(IDEMPOTENCY_KEY, key) }),
    );
    this.pendingCreates.delete(fingerprint);
    const created = this.fromApi(raw);
    this.state.update((list) => [...list, created]);
    return created;
  }

  /**
   * PATCH kèm version đang giữ (optimistic: cập nhật giao diện ngay).
   *
   * - VERSION_CONFLICT: nạp bản mới nhất của server rồi hỏi người dùng. "Tải bản mới" thì trả về
   *   bản server; "Ghi đè" thì gửi lại thay đổi với version mới.
   * - Lỗi khác: hoàn tác và ném lại lỗi để form giữ nguyên.
   */
  async update(id: string, changes: Partial<T>): Promise<T> {
    const current = this.byId(id);
    if (!current) throw new Error(`Không tìm thấy bản ghi ${id}`);

    this.replace({ ...current, ...changes, id, version: current.version });
    try {
      const raw = await firstValueFrom(
        this.http.patch<T>(
          `${this.url}/${id}`,
          { ...this.body(changes), version: current.version },
          { context: new HttpContext().set(SILENT_CODES, ['VERSION_CONFLICT']) },
        ),
      );
      const saved = this.fromApi(raw);
      this.replace(saved);
      return saved;
    } catch (err) {
      const problem = problemOf(err);
      if (problem?.code === 'VERSION_CONFLICT') {
        return this.resolveConflict(id, changes, current, problem.current as T | undefined);
      }
      if (problem?.code === 'NOT_FOUND') {
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

  private async resolveConflict(
    id: string,
    changes: Partial<T>,
    before: T,
    serverCopy: T | undefined,
  ): Promise<T> {
    let latest: T;
    try {
      // Hai request cùng qua bước kiểm tra version thì server không kèm `current`: tự tải lại
      latest = this.fromApi(
        serverCopy ?? (await firstValueFrom(this.http.get<T>(`${this.url}/${id}`))),
      );
    } catch (err) {
      if (errorCode(err) === 'NOT_FOUND') this.dropLocal((item) => item.id === id);
      else this.replace(before);
      throw err;
    }
    this.replace(latest);

    const name = (latest as { name?: unknown }).name;
    const choice = await this.conflicts.ask({ name: typeof name === 'string' ? name : undefined });
    return choice === 'overwrite' ? this.update(id, changes) : latest;
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
