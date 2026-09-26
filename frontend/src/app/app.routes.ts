import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell.component';

export const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'cafes' },
      {
        path: 'cafes',
        title: 'Quán cafe · Dating Master',
        loadComponent: () => import('./features/cafes/cafe-list.page').then((m) => m.CafeListPage),
      },
      {
        path: 'bars',
        title: 'Quán bar · Dating Master',
        loadComponent: () => import('./features/bars/bar-list.page').then((m) => m.BarListPage),
      },
      {
        path: 'restaurants',
        title: 'Quán ăn · Dating Master',
        loadComponent: () =>
          import('./features/restaurants/restaurant-list.page').then((m) => m.RestaurantListPage),
      },
      {
        path: 'girlfriends',
        title: 'Người yêu · Dating Master',
        loadComponent: () =>
          import('./features/girlfriends/girlfriend-list.page').then((m) => m.GirlfriendListPage),
      },
      {
        path: 'girlfriends/:id',
        title: 'Chi tiết · Dating Master',
        loadComponent: () =>
          import('./features/girlfriends/girlfriend-detail.page').then(
            (m) => m.GirlfriendDetailPage,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
