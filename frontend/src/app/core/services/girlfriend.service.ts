import { Injectable } from '@angular/core';
import { CrudStore } from './crud-store';
import { Girlfriend } from '../models/girlfriend.model';

@Injectable({ providedIn: 'root' })
export class GirlfriendService extends CrudStore<Girlfriend> {
  constructor() {
    super('girlfriends');
  }

  /** Giao diện dùng '' cho ngày trống, server dùng null */
  protected override fromApi(raw: Girlfriend): Girlfriend {
    return { ...raw, birthday: raw.birthday ?? '', startedDate: raw.startedDate ?? '' };
  }

  protected override toApi(data: Record<string, unknown>): Record<string, unknown> {
    const body = { ...data };
    for (const key of ['birthday', 'startedDate']) {
      if (key in body && !body[key]) body[key] = null;
    }
    return body;
  }
}
