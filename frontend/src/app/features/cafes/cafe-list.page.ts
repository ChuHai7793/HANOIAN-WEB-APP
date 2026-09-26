import { Component } from '@angular/core';
import { PlaceListComponent } from '../places/place-list.component';
import { CAFE_CONFIG } from '../places/place.config';

@Component({
  selector: 'app-cafe-list-page',
  imports: [PlaceListComponent],
  template: '<app-place-list [config]="config" />',
})
export class CafeListPage {
  protected readonly config = CAFE_CONFIG;
}
