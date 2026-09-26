import { Injectable } from '@angular/core';
import { CrudStore } from './crud-store';
import { PlaceLink } from '../models/place-link.model';
import { PlaceType } from '../models/place.model';
import { seedPlaceLinks } from '../data/seed';

@Injectable({ providedIn: 'root' })
export class PlaceLinkService extends CrudStore<PlaceLink> {
  constructor() {
    super('gfm.placeLinks', 'link', seedPlaceLinks);
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

  removeByGirlfriend(girlfriendId: string): void {
    this.removeWhere((l) => l.girlfriendId === girlfriendId);
  }

  removeByPlace(placeId: string): void {
    this.removeWhere((l) => l.placeId === placeId);
  }
}
