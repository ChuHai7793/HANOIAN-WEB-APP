import { Injectable } from '@angular/core';
import { CrudStore } from './crud-store';
import { Girlfriend } from '../models/girlfriend.model';
import { seedGirlfriends } from '../data/seed';

@Injectable({ providedIn: 'root' })
export class GirlfriendService extends CrudStore<Girlfriend> {
  constructor() {
    super('gfm.girlfriends', 'gf', seedGirlfriends);
  }
}
