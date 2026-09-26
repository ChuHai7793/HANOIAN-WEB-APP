import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';
import { errorMessage } from './api';

/** Đặt true cho request tự xử lý lỗi, không muốn hiện toast chung. */
export const SILENT_ERRORS = new HttpContextToken<boolean>(() => false);

/** Mọi lỗi HTTP được dịch sang tiếng Việt và hiện toast; lỗi vẫn được ném tiếp cho nơi gọi. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && !req.context.get(SILENT_ERRORS)) {
        toast.error(errorMessage(err));
      }
      return throwError(() => err);
    }),
  );
};
