import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';
import { errorCode, errorMessage } from './api';
import { SILENT_CODES, SILENT_ERRORS } from './http-context';

/** Mọi lỗi HTTP được dịch sang tiếng Việt và hiện toast; lỗi vẫn được ném tiếp cho nơi gọi. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  return next(req).pipe(
    catchError((err: unknown) => {
      const handledByCaller =
        req.context.get(SILENT_ERRORS) ||
        req.context.get(SILENT_CODES).includes(errorCode(err) ?? '');
      if (err instanceof HttpErrorResponse && !handledByCaller) {
        toast.error(errorMessage(err));
      }
      return throwError(() => err);
    }),
  );
};
