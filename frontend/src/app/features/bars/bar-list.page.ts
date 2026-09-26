import { Component } from '@angular/core';
import { PlaceListComponent } from '../places/place-list.component';
import { BAR_CONFIG } from '../places/place.config';

@Component({
  selector: 'app-bar-list-page',
  imports: [PlaceListComponent],
  template: '<app-place-list [config]="config" />',
})
export class BarListPage {
  protected readonly config = BAR_CONFIG;
}
