import { HttpErrorResponse } from '@angular/common/http';

/** Cùng origin với frontend: dev đi qua proxy.conf.json, prod qua Caddy. */
export const API_BASE = '/api/v1';

/** Lỗi server trả về theo chuẩn ProblemDetail (RFC 9457). */
export interface ApiProblem {
  status: number;
  title?: string;
  detail?: string;
  code?: string;
  errors?: { field: string; message: string }[];
  current?: unknown;
}

const MESSAGES: Record<string, string> = {
  VALIDATION_FAILED: 'Dữ liệu chưa hợp lệ, hãy kiểm tra lại.',
  MALFORMED_REQUEST: 'Dữ liệu gửi lên không đúng định dạng.',
  UNAUTHORIZED: 'Bạn cần đăng nhập.',
  TOKEN_EXPIRED: 'Phiên đăng nhập đã hết hạn.',
  NOT_FOUND: 'Dữ liệu không còn tồn tại, có thể đã bị xoá ở thiết bị khác.',
  VERSION_CONFLICT: 'Dữ liệu vừa được sửa ở thiết bị khác. Đã tải lại bản mới nhất.',
  LINK_ALREADY_EXISTS: 'Quán này đã được gắn cho người này rồi.',
  EMAIL_TAKEN: 'Email đã được sử dụng.',
  DATA_CONFLICT: 'Dữ liệu bị trùng.',
  IDEMPOTENCY_IN_PROGRESS: 'Yêu cầu đang được xử lý, chờ chút nhé.',
  FILE_TOO_LARGE: 'Ảnh quá lớn (tối đa 12MB).',
  UNSUPPORTED_IMAGE: 'Chỉ nhận ảnh JPG, PNG hoặc WebP.',
  IMPORT_RUNNING: 'Đang có một lần import khác chạy.',
  RATE_LIMITED: 'Bạn thao tác quá nhanh, thử lại sau ít phút.',
  INTERNAL_ERROR: 'Server gặp lỗi, thử lại sau.',
};

export function problemOf(err: unknown): ApiProblem | null {
  if (!(err instanceof HttpErrorResponse)) return null;
  const body = err.error;
  if (body && typeof body === 'object') return { status: err.status, ...body } as ApiProblem;
  return { status: err.status };
}

export function errorCode(err: unknown): string | undefined {
  return problemOf(err)?.code;
}

/** Câu thông báo tiếng Việt cho một lỗi HTTP bất kỳ. */
export function errorMessage(err: unknown): string {
  const problem = problemOf(err);
  if (!problem) return 'Có lỗi xảy ra.';
  if (problem.status === 0) return 'Không kết nối được server. Kiểm tra mạng rồi thử lại.';
  if (problem.code && MESSAGES[problem.code]) {
    const fields = problem.errors?.map((e) => `${e.field}: ${e.message}`).join('; ');
    return fields ? `${MESSAGES[problem.code]} (${fields})` : MESSAGES[problem.code];
  }
  return problem.detail || `Lỗi ${problem.status}.`;
}
