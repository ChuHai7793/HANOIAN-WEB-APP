import { HttpParams } from '@angular/common/http';

/**
 * Tham số GET cho bộ lọc: bỏ giá trị trống (undefined, null, '', mảng rỗng, false); mảng ghép bằng dấu phẩy.
 * Số 0 vẫn gửi (vd. "miễn phí").
 */
export function toQueryParams(query: object): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    if (Array.isArray(value)) {
      if (value.length) params = params.set(key, value.join(','));
      continue;
    }
    params = params.set(key, String(value));
  }
  return params;
}
