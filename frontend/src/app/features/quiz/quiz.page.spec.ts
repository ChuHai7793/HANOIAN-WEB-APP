import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { LoginGate } from '../../core/auth/login-gate.service';
import { ToastService } from '../../core/services/toast.service';
import { QUESTIONS, quizResult } from './quiz.page';

describe('quizResult', () => {
  it('lấy kiểu được chọn nhiều nhất', () => {
    expect(quizResult(['chill', 'romantic', 'chill', 'active', 'chill', 'romantic'])).toBe('chill');
  });

  it('hoà thì lấy kiểu của câu trả lời sau cùng trong các kiểu hoà', () => {
    expect(quizResult(['chill', 'active', 'chill', 'active', 'romantic', 'romantic'])).toBe('romantic');
    expect(quizResult(['romantic', 'active', 'active', 'romantic', 'chill', 'chill'])).toBe('chill');
  });

  it('mỗi câu có đủ 3 kiểu hẹn', () => {
    for (const q of QUESTIONS) {
      expect(q.options.map((o) => o.vibe).sort()).toEqual(['active', 'chill', 'romantic']);
    }
  });
});

describe('LoginGate', () => {
  function setup(loggedIn: boolean) {
    const navigate = vi.fn().mockResolvedValue(true);
    const show = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isLoggedIn: signal(loggedIn) } },
        { provide: Router, useValue: { url: '/explore', navigate } },
        { provide: ToastService, useValue: { show } },
      ],
    });
    return { gate: TestBed.inject(LoginGate), navigate, show };
  }

  it('đã đăng nhập thì cho làm tiếp', () => {
    const { gate, navigate } = setup(true);
    expect(gate.check('lưu quán')).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('khách thì mời đăng ký và quay lại đúng trang', () => {
    const { gate, navigate, show } = setup(false);
    expect(gate.check('lưu quán')).toBe(false);
    expect(show).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/register'], { queryParams: { returnUrl: '/explore' } });
  });
});
