import { Injectable, signal } from '@angular/core';

/**
 * Bọc localStorage. Toàn bộ phần đọc/ghi dữ liệu đi qua đây,
 * nên khi đổi sang REST API chỉ cần thay lớp này và CrudStore.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  /** Bật lên khi localStorage đầy — ảnh upload là nguyên nhân thường gặp nhất */
  readonly quotaExceeded = signal(false);

  private get available(): boolean {
    try {
      return typeof localStorage !== 'undefined';
    } catch {
      return false;
    }
  }

  read<T>(key: string): T[] | null {
    if (!this.available) return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : null;
    } catch {
      console.warn(`[storage] Dữ liệu hỏng ở key "${key}", bỏ qua.`);
      return null;
    }
  }

  /** Trả về false nếu ghi thất bại, thường là do hết dung lượng */
  write<T>(key: string, value: T[]): boolean {
    if (!this.available) return false;
    try {
      localStorage.setItem(key, JSON.stringify(value));
      this.quotaExceeded.set(false);
      return true;
    } catch (err) {
      const isQuota =
        err instanceof DOMException &&
        (err.name === 'QuotaExceededError' || err.code === 22);
      if (isQuota) this.quotaExceeded.set(true);
      console.error(`[storage] Không ghi được key "${key}"`, err);
      return false;
    }
  }

  clear(key: string): void {
    if (!this.available) return;
    localStorage.removeItem(key);
  }
}
