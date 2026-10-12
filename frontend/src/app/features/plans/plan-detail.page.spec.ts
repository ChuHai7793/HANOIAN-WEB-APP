import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '../../core/auth/auth.service';
import { directionsUrl, distanceText, Plan, PlanStop } from '../../core/models/plan.model';
import { CatalogService } from '../../core/services/catalog.service';
import { DataBootstrapService } from '../../core/services/data-bootstrap.service';
import { GirlfriendService } from '../../core/services/girlfriend.service';
import { MatchInboxService } from '../../core/services/match-inbox.service';
import { PlanService } from '../../core/services/plan.service';
import { PlanDetailPage } from './plan-detail.page';

function stop(id: string, name: string, extra: Partial<PlanStop> = {}): PlanStop {
  return {
    id, position: 0, kind: 'place', refId: 'r-' + id, category: 'cafe', name, address: '', district: 'HOAN_KIEM',
    districtLabel: 'Hoàn Kiếm', imageUrl: '', lat: null, lng: null, openTime: '07:00', closeTime: '22:00', indoor: true,
    vibes: [], googleMapsUrl: '', durationMin: 60, note: '', rating: null, memory: '', arrival: '18:00', departure: '19:00',
    distanceFromPrevM: null, travelFromPrevMin: null, travelMode: null, warnings: [], ...extra,
  };
}

function plan(extra: Partial<Plan> = {}): Plan {
  return {
    id: 'p1', title: 'Tối thứ 7', date: '2026-10-17', startTime: '18:00', endTime: '21:00', district: 'HOAN_KIEM',
    districtLabel: 'Hoàn Kiếm', note: '', status: 'draft', memory: '', vibe: 'romantic', budget: null, rainy: false,
    mine: true, ownerName: 'Lan', totalDistanceM: 650,
    stops: [
      stop('a', 'Làm nến', { category: 'workshop', kind: 'spot' }),
      stop('b', 'Phở', { category: 'restaurant', arrival: '19:10', distanceFromPrevM: 650, travelFromPrevMin: 9, travelMode: 'walk', warnings: ['CLOSED'] }),
    ],
    version: 0, createdAt: '', updatedAt: '', ...extra,
  };
}

async function open(p: Plan) {
  const api = { get: vi.fn().mockResolvedValue(p), reorder: vi.fn().mockResolvedValue(p), copy: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'plans/:id', component: PlanDetailPage }]),
      { provide: PlanService, useValue: api },
      { provide: CatalogService, useValue: { districts: vi.fn().mockResolvedValue([]) } },
      { provide: AuthService, useValue: { canEdit: signal(false) } },
      { provide: GirlfriendService, useValue: { items: signal([]) } },
      { provide: MatchInboxService, useValue: { matches: signal([]) } },
      { provide: DataBootstrapService, useValue: { loadAll: vi.fn() } },
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl('/plans/p1');
  await new Promise((r) => setTimeout(r));
  harness.detectChanges();
  return { el: harness.routeNativeElement!, api, harness };
}

describe('PlanDetailPage', () => {
  it('hiện dòng thời gian: giờ tới, quãng đường, cảnh báo; đổi thứ tự gửi đúng danh sách', async () => {
    const { el, api } = await open(plan());
    const text = el.textContent!;
    expect(text).toContain('Làm nến');
    expect(text).toContain('19:10');
    expect(text).toContain('650 m · 9 phút đi bộ');
    expect(text).toContain('Đóng cửa lúc tới');

    el.querySelector<HTMLButtonElement>('button[aria-label="Xuống sau"]')!.click();
    expect(api.reorder).toHaveBeenCalledWith('p1', ['b', 'a']);
  });

  it('plan người khác rủ: chỉ xem, có nút lưu về plan của tôi', async () => {
    const { el } = await open(plan({ mine: false }));
    expect(el.textContent).toContain('Lan rủ bạn đi');
    expect(el.textContent).toContain('Lưu về plan của tôi');
    expect(el.querySelector('button[aria-label="Xuống sau"]')).toBeNull();
    expect(el.textContent).not.toContain('Thêm điểm');
  });
});

describe('plan helpers', () => {
  it('khoảng cách và link chỉ đường qua các điểm có toạ độ', () => {
    expect(distanceText(640)).toBe('640 m');
    expect(distanceText(2450)).toBe('2,5 km');
    const url = directionsUrl([
      stop('a', 'A', { lat: 21.03, lng: 105.85 }),
      stop('b', 'B'),
      stop('c', 'C', { lat: 21.02, lng: 105.84 }),
      stop('d', 'D', { lat: 21.01, lng: 105.83 }),
    ])!;
    expect(url).toContain('origin=21.03%2C105.85');
    expect(url).toContain('destination=21.01%2C105.83');
    expect(url).toContain('waypoints=21.02%2C105.84');
    expect(directionsUrl([stop('a', 'A', { lat: 1, lng: 2 })])).toBeNull();
  });
});
