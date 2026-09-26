import { HttpContextToken } from '@angular/common/http';

/** Đặt true cho request không cần Bearer (login, register, refresh, logout). */
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);

/** Đặt true cho request tự xử lý lỗi, không muốn hiện toast chung. */
export const SILENT_ERRORS = new HttpContextToken<boolean>(() => false);
