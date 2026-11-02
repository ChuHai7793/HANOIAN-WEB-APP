import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DataBootstrapService } from './data-bootstrap.service';
import { AuthService } from '../auth/auth.service';

describe('DataBootstrapService', () => {
  let backend: HttpTestingController;
  let bootstrap: DataBootstrapService;
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
    bootstrap = TestBed.inject(DataBootstrapService);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => backend.verify());

  const signIn = (role: 'ADMIN' | 'GUEST') =>
    auth['setSession']({
      accessToken: 't',
      expiresIn: 900,
      newUser: false,
      user: { id: 'u1', email: 'a@b.c', username: null, displayName: 'A', role, avatarUrl: null },
    });

  it('guest không tải người yêu và liên kết quán (dữ liệu riêng của admin, backend trả 403)', async () => {
    signIn('GUEST');
    const done = bootstrap.loadAll();
    backend.expectOne('/api/v1/places').flush([]);
    backend.expectOne('/api/v1/me/spots').flush([]);
    backend.expectNone('/api/v1/girlfriends');
    backend.expectNone('/api/v1/place-links');
    await done;
    expect(bootstrap.status()).toBe('ready');
  });

  it('admin tải đủ cả bốn bảng', async () => {
    signIn('ADMIN');
    const done = bootstrap.loadAll();
    for (const url of ['/api/v1/places', '/api/v1/me/spots', '/api/v1/girlfriends', '/api/v1/place-links']) {
      backend.expectOne(url).flush([]);
    }
    await done;
    expect(bootstrap.status()).toBe('ready');
  });
});
