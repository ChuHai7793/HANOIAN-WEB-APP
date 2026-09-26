import { Component } from '@angular/core';
import { PlaceListComponent } from '../places/place-list.component';
import { RESTAURANT_CONFIG } from '../places/place.config';

@Component({
  selector: 'app-restaurant-list-page',
  imports: [PlaceListComponent],
  template: '<app-place-list [config]="config" />',
})
export class RestaurantListPage {
  protected readonly config = RESTAURANT_CONFIG;
}
