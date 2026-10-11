import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ChatMessage, Match } from '../../core/models/dating.model';
import { DatingService } from '../../core/services/dating.service';
import { ChatPage, mergeMessages } from './chat.page';

const msg = (id: string, at: string, mine: boolean, readAt: string | null = null): ChatMessage => ({
  id,
  senderId: mine ? 'me' : 'lan',
  mine,
  body: `tin ${id}`,
  createdAt: at,
  readAt,
});

const match: Match = {
  id: 'm1',
  user: { userId: 'lan', displayName: 'Lan', age: 24, gender: 'female', city: 'Hà Nội', bio: '', avatarUrl: null, photos: [], interests: [] },
  matchedAt: '2026-10-01T10:00:00Z',
  lastMessage: null,
  unread: 1,
};

function fakeDating(first: ChatMessage[] | HttpErrorResponse) {
  return {
    matches: vi.fn().mockResolvedValue([match]),
    messages: vi.fn().mockImplementation(() => (first instanceof HttpErrorResponse ? Promise.reject(first) : Promise.resolve(first))),
    sendMessage: vi.fn().mockImplementation((_: string, body: string) =>
      Promise.resolve({ ...msg('new', '2026-10-02T10:00:00Z', true), body }),
    ),
    markRead: vi.fn().mockResolvedValue(undefined),
  };
}

async function open(dating: ReturnType<typeof fakeDating>) {
  TestBed.configureTestingModule({
    providers: [provideRouter([{ path: 'dating/matches/:id', component: ChatPage }]), { provide: DatingService, useValue: dating }],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl('/dating/matches/m1');
  await new Promise((r) => setTimeout(r));
  harness.detectChanges();
  return harness;
}

describe('mergeMessages', () => {
  it('bỏ trùng theo id và xếp cũ trước mới sau', () => {
    const a = msg('a', '2026-10-01T10:00:00Z', true);
    const b = msg('b', '2026-10-01T11:00:00Z', false);
    const aSeen = { ...a, readAt: '2026-10-01T12:00:00Z' };
    expect(mergeMessages([b], [aSeen, b]).map((m) => [m.id, m.readAt])).toEqual([
      ['a', '2026-10-01T12:00:00Z'],
      ['b', null],
    ]);
  });
});

describe('ChatPage', () => {
  it('hiện tin, đánh dấu đã xem tin người kia gửi, gửi tin đã bỏ khoảng trắng', async () => {
    const dating = fakeDating([msg('1', '2026-10-02T09:00:00Z', false)]);
    const harness = await open(dating);
    const el = harness.routeNativeElement!;

    expect(el.textContent).toContain('Lan, 24');
    expect(el.textContent).toContain('tin 1');
    expect(dating.markRead).toHaveBeenCalledWith('m1');

    const box = el.querySelector('textarea')!;
    box.value = '  Chào em  ';
    box.dispatchEvent(new Event('input'));
    harness.detectChanges();
    el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await new Promise((r) => setTimeout(r));
    harness.detectChanges();

    expect(dating.sendMessage).toHaveBeenCalledWith('m1', 'Chào em');
    expect(el.textContent).toContain('Chào em');
    expect(box.value).toBe('');
  });

  it('match không còn (404) thì báo cuộc trò chuyện không còn', async () => {
    const notFound = new HttpErrorResponse({ status: 404, error: { status: 404, code: 'NOT_FOUND' } });
    const harness = await open(fakeDating(notFound));
    expect(harness.routeNativeElement!.textContent).toContain('không còn');
    expect(harness.routeNativeElement!.querySelector('textarea')).toBeNull();
  });
});
