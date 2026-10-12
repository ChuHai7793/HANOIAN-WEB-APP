import { TestBed } from '@angular/core/testing';
import { defaultPlaceVibes, defaultSpotVibes, VibeChoice } from '../../core/models/vibe.model';
import { VibePickerComponent } from './vibe-picker.component';

function render(choice: VibeChoice, opts: { source?: 'default' | 'claude' | 'admin'; saved?: VibeChoice['vibes'] } = {}) {
  const fixture = TestBed.createComponent(VibePickerComponent);
  fixture.componentRef.setInput('choice', choice);
  fixture.componentRef.setInput('defaults', ['chill']);
  fixture.componentRef.setInput('source', opts.source ?? null);
  fixture.componentRef.setInput('saved', opts.saved ?? null);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const chip = (label: string) =>
    [...el.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')].find((b) => b.textContent!.includes(label))!;
  return { fixture, el, chip };
}

describe('VibePickerComponent', () => {
  it('tự gán: hiện nhãn theo loại; bấm một nhãn là chuyển sang chọn tay', () => {
    const { fixture, el, chip } = render({ vibes: [], auto: true });
    expect(chip('Chill').getAttribute('aria-pressed')).toBe('true');
    expect(el.textContent).toContain('Tự gán theo loại');

    chip('Lãng mạn').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.choice()).toEqual({ vibes: ['chill', 'romantic'], auto: false });
    expect(el.textContent).toContain('Chọn tay');
  });

  it('nhãn Claude giữ nguyên thì báo Claude gán; "Để hệ thống tự gán" quay về mặc định', () => {
    const { fixture, el } = render({ vibes: ['active'], auto: false }, { source: 'claude', saved: ['active'] });
    expect(el.textContent).toContain('Claude gán');

    const reset = [...el.querySelectorAll('button')].find((b) => b.textContent!.includes('tự gán'))!;
    reset.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.choice()).toEqual({ vibes: ['chill'], auto: true });
  });
});

describe('nhãn mặc định (giống VibeDefaults / V15)', () => {
  it('quán', () => {
    expect(defaultPlaceVibes('cafe', 'luxury')).toEqual(['chill']);
    expect(defaultPlaceVibes('bar', 'cheap')).toEqual(['romantic']);
    expect(defaultPlaceVibes('restaurant', 'medium')).toEqual(['chill', 'romantic']);
    expect(defaultPlaceVibes('restaurant', 'high')).toEqual(['romantic']);
  });

  it('chỗ chơi', () => {
    expect(defaultSpotVibes('sport')).toEqual(['active']);
    expect(defaultSpotVibes('workshop')).toEqual(['romantic']);
    expect(defaultSpotVibes('museum')).toEqual(['chill']);
    expect(defaultSpotVibes('outdoor')).toEqual(['chill', 'romantic']);
  });
});
