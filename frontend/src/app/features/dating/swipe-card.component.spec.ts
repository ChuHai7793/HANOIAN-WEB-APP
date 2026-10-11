import { TestBed } from '@angular/core/testing';
import { SwipeCardComponent } from './swipe-card.component';
import { Candidate } from '../../core/models/dating.model';

const LAN: Candidate = {
  userId: 'u1',
  displayName: 'Lan',
  age: 24,
  gender: 'female',
  city: 'Hà Nội',
  bio: 'Thích cafe',
  avatarUrl: '/uploads/a.webp',
  photos: ['/uploads/b.webp', '/uploads/a.webp'],
  interests: ['cafe'],
};

describe('SwipeCardComponent', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function create() {
    const fixture = TestBed.createComponent(SwipeCardComponent);
    fixture.componentRef.setInput('candidate', LAN);
    fixture.detectChanges();
    const emitted: boolean[] = [];
    fixture.componentInstance.swiped.subscribe((v) => emitted.push(v));
    const card = (fixture.nativeElement as HTMLElement).querySelector('div')!;
    return { fixture, card, emitted };
  }

  function drag(card: HTMLElement, dx: number) {
    card.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100 }));
    card.dispatchEvent(new PointerEvent('pointermove', { clientX: 100 + dx }));
    card.dispatchEvent(new PointerEvent('pointerup', { clientX: 100 + dx }));
  }

  it('kéo phải quá ngưỡng là thích, kéo trái là bỏ qua', () => {
    const { card, emitted } = create();
    drag(card, 150);
    vi.advanceTimersByTime(250);
    expect(emitted).toEqual([true]);

    const second = create();
    drag(second.card, -150);
    vi.advanceTimersByTime(250);
    expect(second.emitted).toEqual([false]);
  });

  it('thả trước ngưỡng thì thẻ trở lại giữa, không quẹt', () => {
    const { fixture, card, emitted } = create();
    drag(card, 60);
    vi.advanceTimersByTime(250);
    fixture.detectChanges();
    expect(emitted).toEqual([]);
    expect(card.style.transform).toContain('translateX(0px)');
  });

  it('nút ✖️/❤️ của trang gọi fling: thẻ bay ra rồi báo quẹt', () => {
    const { fixture, emitted } = create();
    fixture.componentInstance.fling(true);
    vi.advanceTimersByTime(250);
    expect(emitted).toEqual([true]);
  });

  it('ảnh đại diện đứng đầu, không lặp ảnh', () => {
    const { fixture } = create();
    const dots = (fixture.nativeElement as HTMLElement).querySelectorAll('span.h-1');
    expect(dots.length).toBe(2);
    expect((fixture.nativeElement as HTMLElement).querySelector('img')!.getAttribute('src')).toBe('/uploads/a.webp');
  });
});
