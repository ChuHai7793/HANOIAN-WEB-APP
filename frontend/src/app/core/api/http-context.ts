import { HttpContextToken } from '@angular/common/http';

/** Đặt true cho request không cần Bearer (login, register, refresh, logout). */
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);

/** Đặt true cho request tự xử lý lỗi, không muốn hiện toast chung. */
export const SILENT_ERRORS = new HttpContextToken<boolean>(() => false);

/** Idempotency-Key gửi kèm POST. Không đặt thì idempotencyInterceptor tự sinh key mới. */
export const IDEMPOTENCY_KEY = new HttpContextToken<string | null>(() => null);

/** Mã lỗi nơi gọi tự xử lý (ví dụ hiện dialog), errorInterceptor không hiện toast cho các mã này. */
export const SILENT_CODES = new HttpContextToken<readonly string[]>(() => []);
