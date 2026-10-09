import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ProfileFormComponent } from './profile-form.component';
import { AuthService } from '../../core/auth/auth.service';
import { Profile } from '../../core/models/profile.model';

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const EMPTY: Profile = {
  displayName: 'Lan',
  avatarUrl: null,
  birthday: null,
  gender: null,
  phone: null,
  city: null,
  bio: '',
  completedAt: null,
  version: null,
};

describe('ProfileFormComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProfileFormComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function open(profile: Profile) {
    const fixture = TestBed.createComponent(ProfileFormComponent);
    fixture.detectChanges();
    http.expectOne('/api/v1/me/profile').flush(profile);
    await tick();
    fixture.detectChanges();
    return fixture;
  }

  function submit(el: HTMLElement) {
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
  }

  it('lưu lần đầu với version null, rồi cập nhật tên ở thanh menu', async () => {
    const fixture = await open(EMPTY);
    const el = fixture.nativeElement as HTMLElement;
    const city = el.querySelector<HTMLInputElement>('input[formControlName="city"]')!;
    city.value = '  Hà Nội ';
    city.dispatchEvent(new Event('input'));
    const done = vi.fn();
    fixture.componentInstance.done.subscribe(done);
    const updateProfile = vi.spyOn(TestBed.inject(AuthService), 'updateProfile');

    submit(el);
    const req = http.expectOne('/api/v1/me/profile');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      displayName: 'Lan',
      avatarUrl: null,
      birthday: null,
      gender: null,
      phone: null,
      city: 'Hà Nội',
      bio: '',
      version: null,
    });
    req.flush({ ...EMPTY, city: 'Hà Nội', version: 0, completedAt: '2026-10-09T00:00:00Z' });
    await tick();

    expect(updateProfile).toHaveBeenCalledWith('Lan', null);
    expect(done).toHaveBeenCalled();
  });

  it('số điện thoại sai định dạng thì không gửi', async () => {
    const fixture = await open(EMPTY);
    const el = fixture.nativeElement as HTMLElement;
    const phone = el.querySelector<HTMLInputElement>('input[formControlName="phone"]')!;
    phone.value = 'abc';
    phone.dispatchEvent(new Event('input'));
    submit(el);
    http.expectNone('/api/v1/me/profile');
  });

  it('xung đột version: nạp bản mới nhất, lần lưu sau gửi version mới', async () => {
    const fixture = await open({ ...EMPTY, version: 0 });
    const el = fixture.nativeElement as HTMLElement;

    submit(el);
    http
      .expectOne('/api/v1/me/profile')
      .flush(
        { code: 'VERSION_CONFLICT', current: { ...EMPTY, displayName: 'Lan (máy khác)', version: 3 } },
        { status: 409, statusText: 'Conflict' },
      );
    await tick();
    fixture.detectChanges();
    expect(el.querySelector<HTMLInputElement>('input[formControlName="displayName"]')!.value).toBe(
      'Lan (máy khác)',
    );

    submit(el);
    const retry = http.expectOne('/api/v1/me/profile');
    expect(retry.request.body.version).toBe(3);
    retry.flush({ ...EMPTY, version: 4 });
    await tick();
  });
});
