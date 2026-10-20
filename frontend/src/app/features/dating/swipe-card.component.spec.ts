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
  sharedPlaces: [
    { catalogId: 'c1', name: 'Cafe Cuối Ngõ', type: 'cafe', district: 'Cầu Giấy', priceFrom: 30_000, priceTo: null },
    { catalogId: 'c2', name: 'Echoes Café', type: 'cafe', district: 'Ba Đình', priceFrom: 50_000, priceTo: 90_000 },
    { catalogId: 'c3', name: 'Phát Ký', type: 'restaurant', district: 'Hoàn Kiếm', priceFrom: null, priceTo: null },
  ],
  fit: 75,
  superLikedMe: false,
};

describe('SwipeCardComponent', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function create(canSuperLike = false) {
    const fixture = TestBed.createComponent(SwipeCardComponent);
    fixture.componentRef.setInput('candidate', LAN);
    fixture.componentRef.setInput('canSuperLike', canSuperLike);
    fixture.detectChanges();
    const emitted: (boolean | 'super')[] = [];
    fixture.componentInstance.swiped.subscribe((v) => emitted.push(v));
    fixture.componentInstance.superSwiped.subscribe(() => emitted.push('super'));
    const card = (fixture.nativeElement as HTMLElement).querySelector('article')!;
    return { fixture, card, emitted };
  }

  function drag(card: HTMLElement, dx: number, dy = 0) {
    card.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, clientY: 300 }));
    card.dispatchEvent(new PointerEvent('pointermove', { clientX: 100 + dx, clientY: 300 + dy }));
    card.dispatchEvent(new PointerEvent('pointerup', { clientX: 100 + dx, clientY: 300 + dy }));
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
    expect(card.style.transform).toContain('translate(0px, 0px)');
  });

  it('nút ✖️/❤️ của trang gọi fling: thẻ bay ra rồi báo quẹt', () => {
    const { fixture, emitted } = create();
    fixture.componentInstance.fling(true);
    vi.advanceTimersByTime(250);
    expect(emitted).toEqual([true]);
  });

  it('kéo lên là siêu thích khi còn lượt; hết lượt thì thẻ trở lại', () => {
    const { card, emitted } = create(true);
    drag(card, 10, -150);
    vi.advanceTimersByTime(250);
    expect(emitted).toEqual(['super']);

    const none = create(false);
    drag(none.card, 10, -150);
    vi.advanceTimersByTime(250);
    none.fixture.detectChanges();
    expect(none.emitted).toEqual([]);
    expect(none.card.style.transform).toContain('translate(0px, 0px)');
  });

  it('hiện hợp gu và tối đa 2 quán cùng lưu, còn lại gộp "+N"', () => {
    const { fixture } = create();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Hợp gu 75%');
    expect(text).toContain('Cùng lưu Cafe Cuối Ngõ, Echoes Café +1');
    expect(text).not.toContain('Phát Ký');
  });

  it('ảnh đại diện đứng đầu, không lặp ảnh', () => {
    const { fixture } = create();
    const dots = (fixture.nativeElement as HTMLElement).querySelectorAll('span.h-1');
    expect(dots.length).toBe(2);
    expect((fixture.nativeElement as HTMLElement).querySelector('img')!.getAttribute('src')).toBe('/uploads/a.webp');
  });
});
