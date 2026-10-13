import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { LoginGate } from '../../core/auth/login-gate.service';
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
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isLoggedIn: signal(loggedIn) } },
        { provide: Router, useValue: { url: '/explore', navigate } },
      ],
    });
    return { gate: TestBed.inject(LoginGate), navigate };
  }

  it('đã đăng nhập thì cho làm tiếp', () => {
    const { gate } = setup(true);
    expect(gate.check('lưu quán')).toBe(true);
    expect(gate.prompt()).toBeNull();
  });

  it('khách thì mở popup đăng nhập ngay tại trang, không chuyển trang', () => {
    const { gate, navigate } = setup(false);
    const resume = vi.fn();
    expect(gate.check('lưu quán', resume)).toBe(false);
    expect(gate.prompt()).toEqual({ action: 'lưu quán', returnUrl: '/explore', resume });
    expect(navigate).not.toHaveBeenCalled();
    gate.close();
    expect(gate.prompt()).toBeNull();
  });
});
