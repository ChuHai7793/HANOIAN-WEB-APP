import { Injectable } from '@angular/core';
import { CrudStore } from './crud-store';
import { PlaceLink } from '../models/place-link.model';
import { PlaceType } from '../models/place.model';

@Injectable({ providedIn: 'root' })
export class PlaceLinkService extends CrudStore<PlaceLink> {
  constructor() {
    super('place-links');
  }

  protected override fromApi(raw: PlaceLink): PlaceLink {
    return { ...raw, lastVisitedAt: raw.lastVisitedAt ?? '' };
  }

  protected override toApi(data: Record<string, unknown>): Record<string, unknown> {
    const body = { ...data };
    if ('lastVisitedAt' in body && !body['lastVisitedAt']) body['lastVisitedAt'] = null;
    return body;
  }

  forGirlfriend(girlfriendId: string, type?: PlaceType): PlaceLink[] {
    return this.items().filter(
      (l) => l.girlfriendId === girlfriendId && (!type || l.placeType === type),
    );
  }

  countFor(girlfriendId: string): number {
    return this.items().filter((l) => l.girlfriendId === girlfriendId).length;
  }

  /** Id các quán đã gắn — dùng để loại khỏi danh sách chọn thêm */
  linkedPlaceIds(girlfriendId: string): Set<string> {
    return new Set(
      this.items()
        .filter((l) => l.girlfriendId === girlfriendId)
        .map((l) => l.placeId),
    );
  }

  /** Server đã cascade khi xoá người yêu, chỉ cần bỏ khỏi state */
  dropByGirlfriend(girlfriendId: string): void {
    this.dropLocal((l) => l.girlfriendId === girlfriendId);
  }

  /** Server đã cascade khi xoá quán, chỉ cần bỏ khỏi state */
  dropByPlace(placeId: string): void {
    this.dropLocal((l) => l.placeId === placeId);
  }
}
