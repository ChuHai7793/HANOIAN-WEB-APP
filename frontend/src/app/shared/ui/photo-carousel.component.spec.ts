import { TestBed } from '@angular/core/testing';
import { PhotoCarouselComponent } from './photo-carousel.component';
import { PhotoListEditorComponent } from './photo-list-editor.component';

describe('PhotoCarouselComponent', () => {
  function render(photos: string[]) {
    const fixture = TestBed.createComponent(PhotoCarouselComponent);
    fixture.componentRef.setInput('photos', photos);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const src = () => el.querySelector('img')!.getAttribute('src');
    return { fixture, el, src };
  }

  it('mũi tên chuyển ảnh, vòng lại đầu / cuối, không lan click ra ngoài', () => {
    const { fixture, el, src } = render(['a.jpg', 'b.jpg', 'c.jpg']);
    const outer = vi.fn();
    el.addEventListener('click', outer);
    expect(src()).toBe('a.jpg');

    el.querySelector<HTMLButtonElement>('[aria-label="Ảnh sau"]')!.click();
    fixture.detectChanges();
    expect(src()).toBe('b.jpg');

    el.querySelector<HTMLButtonElement>('[aria-label="Ảnh trước"]')!.click();
    el.querySelector<HTMLButtonElement>('[aria-label="Ảnh trước"]')!.click();
    fixture.detectChanges();
    expect(src()).toBe('c.jpg');
    expect(outer).not.toHaveBeenCalled();

    el.querySelector<HTMLButtonElement>('[aria-label="Ảnh 1"]')!.click();
    fixture.detectChanges();
    expect(src()).toBe('a.jpg');
  });

  it('một ảnh thì không có mũi tên; mảng mới cùng ảnh không làm quay về ảnh đầu', () => {
    const one = render(['a.jpg']);
    expect(one.el.querySelector('[aria-label="Ảnh sau"]')).toBeNull();

    const { fixture, el, src } = render(['a.jpg', 'b.jpg']);
    el.querySelector<HTMLButtonElement>('[aria-label="Ảnh sau"]')!.click();
    fixture.componentRef.setInput('photos', ['a.jpg', 'b.jpg']);
    fixture.detectChanges();
    expect(src()).toBe('b.jpg');
    fixture.componentRef.setInput('photos', ['c.jpg', 'd.jpg']);
    fixture.detectChanges();
    expect(src()).toBe('c.jpg');
  });
});

describe('PhotoListEditorComponent', () => {
  it('đổi thứ tự (ảnh đầu là bìa) và bỏ ảnh', () => {
    const fixture = TestBed.createComponent(PhotoListEditorComponent);
    fixture.componentRef.setInput('photos', ['a.jpg', 'b.jpg', 'c.jpg']);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('3/6');
    // Luôn đủ 6 ô: 3 ảnh + 3 ô trống để thêm
    expect(el.querySelectorAll('[aria-label^="Thêm ảnh "]').length).toBe(3);

    el.querySelectorAll<HTMLButtonElement>('[aria-label="Lên trước"]')[1].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.photos()).toEqual(['b.jpg', 'a.jpg', 'c.jpg']);

    el.querySelectorAll<HTMLButtonElement>('[aria-label="Bỏ ảnh"]')[2].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.photos()).toEqual(['b.jpg', 'a.jpg']);
  });
});
