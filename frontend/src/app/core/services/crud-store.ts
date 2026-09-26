import { computed, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { newId, nowIso } from '../utils/id';

export interface Entity {
  id: string;
}

/**
 * Kho CRUD dùng chung cho mọi thực thể: nạp từ localStorage lúc khởi tạo,
 * mọi thay đổi ghi lại ngay. State giữ trong signal nên component chỉ cần đọc.
 */
export abstract class CrudStore<T extends Entity> {
  private readonly storage = inject(StorageService);
  private readonly state = signal<T[]>([]);

  readonly items = this.state.asReadonly();
  readonly count = computed(() => this.state().length);

  protected constructor(
    private readonly storageKey: string,
    private readonly idPrefix: string,
    seed: () => T[],
  ) {
    const saved = this.storage.read<T>(this.storageKey);
    if (saved) {
      this.state.set(saved);
    } else {
      const initial = seed();
      this.state.set(initial);
      this.storage.write(this.storageKey, initial);
    }
  }

  byId(id: string): T | undefined {
    return this.state().find((item) => item.id === id);
  }

  create(data: Omit<T, 'id'>): T {
    const item = { ...data, id: newId(this.idPrefix) } as T;
    this.persist([...this.state(), item]);
    return item;
  }

  update(id: string, changes: Partial<T>): void {
    this.persist(
      this.state().map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  }

  remove(id: string): void {
    this.persist(this.state().filter((item) => item.id !== id));
  }

  /** Xoá nhiều bản ghi theo điều kiện — dùng khi xoá kèm liên kết */
  removeWhere(predicate: (item: T) => boolean): void {
    this.persist(this.state().filter((item) => !predicate(item)));
  }

  /** Xoá sạch dữ liệu và nạp lại bộ mẫu */
  reset(seed: () => T[]): void {
    this.persist(seed());
  }

  protected touch(): string {
    return nowIso();
  }

  private persist(next: T[]): void {
    this.state.set(next);
    this.storage.write(this.storageKey, next);
  }
}
