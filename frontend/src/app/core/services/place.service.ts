import { computed, Injectable } from '@angular/core';
import { CrudStore } from './crud-store';
import { Place, PlaceType } from '../models/place.model';
import { seedPlaces } from '../data/seed';

@Injectable({ providedIn: 'root' })
export class PlaceService extends CrudStore<Place> {
  constructor() {
    super('gfm.places', 'place', seedPlaces);
  }

  readonly cafes = computed(() => this.items().filter((p) => p.type === 'cafe'));
  readonly restaurants = computed(() =>
    this.items().filter((p) => p.type === 'restaurant'),
  );
  readonly bars = computed(() => this.items().filter((p) => p.type === 'bar'));

  byType(type: PlaceType) {
    switch (type) {
      case 'cafe':
        return this.cafes;
      case 'bar':
        return this.bars;
      default:
        return this.restaurants;
    }
  }
}
