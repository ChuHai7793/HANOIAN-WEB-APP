import { HttpErrorResponse } from '@angular/common/http';

/** Cùng origin với frontend: dev đi qua proxy.conf.json, prod qua Caddy. */
export const API_BASE = '/api/v1';

/**
 * Địa chỉ backend cho kết nối SSE, truyền lúc build: `ng build --define "STREAM_ORIGIN='https://…'"`.
 * Không truyền (local, test) thì đi cùng domain qua proxy / rewrite như mọi API khác.
 */
declare const STREAM_ORIGIN: string | undefined;
export const STREAM_BASE = (typeof STREAM_ORIGIN === 'string' ? STREAM_ORIGIN : '') + API_BASE;

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
  TOKEN_EXPIRED: 'Phiên đăng nhập đã hết hạn, hãy đăng nhập lại.',
  INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  NOT_FOUND: 'Dữ liệu không còn tồn tại, có thể đã bị xoá ở thiết bị khác.',
  VERSION_CONFLICT: 'Dữ liệu vừa được sửa ở thiết bị khác. Đã tải lại bản mới nhất.',
  LINK_ALREADY_EXISTS: 'Quán này đã được gắn cho người này rồi.',
  EMAIL_TAKEN: 'Email đã được sử dụng.',
  SOCIAL_LOGIN_DISABLED: 'Cách đăng nhập này chưa được bật.',
  SOCIAL_TOKEN_INVALID: 'Không xác minh được tài khoản, hãy thử lại.',
  SOCIAL_EMAIL_MISSING: 'Tài khoản này không chia sẻ email đã xác minh. Hãy cho phép email hoặc đăng ký bằng email.',
  DATA_CONFLICT: 'Dữ liệu bị trùng.',
  IDEMPOTENCY_IN_PROGRESS: 'Yêu cầu đang được xử lý, chờ chút nhé.',
  IDEMPOTENCY_KEY_REUSED: 'Yêu cầu bị trùng mã với một yêu cầu khác, hãy thử lại.',
  FILE_TOO_LARGE: 'Ảnh quá lớn (tối đa 12MB).',
  UNSUPPORTED_IMAGE: 'Chỉ nhận ảnh JPG, PNG hoặc WebP.',
  IMPORT_RUNNING: 'Đang có một lần import khác chạy.',
  MAPS_URL_NOT_ALLOWED: 'Chỉ nhận link Google Maps (bắt đầu bằng https://).',
  MAPS_RESOLVE_FAILED: 'Không mở được link Google Maps, thử lại sau hoặc nhập toạ độ bằng tay.',
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

/** Nhãn hiển thị của các trường hay gặp trong lỗi kiểm tra dữ liệu (tên trường lấy từ API). */
const FIELD_LABELS: Record<string, string> = {
  name: 'Tên',
  address: 'Địa chỉ',
  description: 'Mô tả',
  note: 'Ghi chú',
  hoursNote: 'Ghi chú giờ, giá',
  cuisine: 'Món',
  imageUrl: 'Ảnh',
  photos: 'Ảnh',
  googleMapsUrl: 'Link Google Maps',
  bookingUrl: 'Link đặt chỗ',
  priceFrom: 'Giá từ',
  priceTo: 'Giá đến',
  durationMin: 'Thời lượng',
  rating: 'Số sao',
  body: 'Nhận xét',
  title: 'Tiêu đề',
  email: 'Email',
  password: 'Mật khẩu',
  displayName: 'Tên hiển thị',
  phone: 'Số điện thoại',
  city: 'Thành phố',
  bio: 'Giới thiệu',
  interests: 'Sở thích',
  hobbies: 'Sở thích',
  lat: 'Vĩ độ',
  lng: 'Kinh độ',
};

/** "photos[2]" → "Ảnh 3", "hoursNote" → "Ghi chú giờ, giá"; trường lạ giữ nguyên tên. */
export function fieldLabel(field: string): string {
  const m = /^(\w+)(?:\[(\d+)\])?/.exec(field);
  if (!m) return field;
  const label = FIELD_LABELS[m[1]] ?? field;
  return m[2] !== undefined && FIELD_LABELS[m[1]] ? `${label} ${Number(m[2]) + 1}` : label;
}

/** Câu thông báo tiếng Việt cho một lỗi HTTP bất kỳ. */
export function errorMessage(err: unknown): string {
  const problem = problemOf(err);
  if (!problem) return 'Có lỗi xảy ra.';
  if (problem.status === 0) return 'Không kết nối được server. Kiểm tra mạng rồi thử lại.';
  if (problem.code && MESSAGES[problem.code]) {
    const fields = problem.errors?.map((e) => `${fieldLabel(e.field)}: ${e.message}`).join('; ');
    return fields ? `${MESSAGES[problem.code]} (${fields})` : MESSAGES[problem.code];
  }
  return problem.detail || `Lỗi ${problem.status}.`;
}
