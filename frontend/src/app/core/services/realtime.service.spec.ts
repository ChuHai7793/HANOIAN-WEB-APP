import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, take, toArray } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { backoff, parseSse, RealtimeService } from './realtime.service';

describe('parseSse', () => {
  it('tách sự kiện hoàn chỉnh, bỏ nhịp tim, giữ phần chưa đủ', () => {
    const { events, rest } = parseSse('event:ready\ndata:{}\n\n:ping\n\nevent: message\ndata: {"a":1}\n\nevent:read\ndata:{"b"');
    expect(events).toEqual([
      { type: 'ready', data: '{}' },
      { type: 'message', data: '{"a":1}' },
    ]);
    expect(rest).toBe('event:read\ndata:{"b"');
  });
});

describe('backoff', () => {
  it('tăng dần, có ngẫu nhiên, tối đa 30 giây', () => {
    for (let i = 0; i < 20; i++) {
      expect(backoff(0)).toBeGreaterThanOrEqual(500);
      expect(backoff(0)).toBeLessThanOrEqual(1000);
      expect(backoff(10)).toBeLessThanOrEqual(30_000);
      expect(backoff(10)).toBeGreaterThanOrEqual(15_000);
    }
  });
});

describe('RealtimeService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('đăng nhập thì nối, gửi Bearer, phát sự kiện đã đọc được', async () => {
    const chunks = ['event:ready\ndata:{}\n\n', 'event:message\ndata:{"matchId":"m1","message":{"id":"x"}}\n\n'];
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        new ReadableStream({
          start(c) {
            for (const ch of chunks) c.enqueue(new TextEncoder().encode(ch));
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { isLoggedIn: signal(true), token: () => 'tok', refreshAccessToken: vi.fn() } }],
    });
    const realtime = TestBed.inject(RealtimeService);
    const received = firstValueFrom(realtime.events.pipe(take(2), toArray()));
    TestBed.tick();

    const events = await received;
    expect(events.map((e) => e.type)).toEqual(['ready', 'message']);
    expect(realtime.connected()).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/dating/stream');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok');
  });
});
