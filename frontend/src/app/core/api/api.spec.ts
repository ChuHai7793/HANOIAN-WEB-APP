import { HttpErrorResponse } from '@angular/common/http';
import { errorMessage, fieldLabel } from './api';

describe('errorMessage', () => {
  it('đổi tên trường kỹ thuật thành nhãn tiếng Việt', () => {
    expect(fieldLabel('hoursNote')).toBe('Ghi chú giờ, giá');
    expect(fieldLabel('photos[2]')).toBe('Ảnh 3');
    expect(fieldLabel('somethingNew')).toBe('somethingNew');
  });

  it('lỗi kiểm tra dữ liệu ghép nhãn trường với câu báo của server', () => {
    const err = new HttpErrorResponse({
      status: 400,
      error: {
        code: 'VALIDATION_FAILED',
        errors: [
          { field: 'hoursNote', message: 'tối đa 1000 ký tự' },
          { field: 'name', message: 'không được để trống' },
        ],
      },
    });
    expect(errorMessage(err)).toContain('Ghi chú giờ, giá: tối đa 1000 ký tự; Tên: không được để trống');
  });
});
