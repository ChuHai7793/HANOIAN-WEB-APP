import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell.component';
import { adminGuard, authGuard, guestGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Đăng nhập · Dating Master',
    canMatch: [guestGuard],
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    title: 'Đăng ký · Dating Master',
    canMatch: [guestGuard],
    loadComponent: () => import('./features/auth/register.page').then((m) => m.RegisterPage),
  },
  {
    path: 'onboarding',
    title: 'Hoàn thiện hồ sơ · Dating Master',
    canMatch: [authGuard],
    loadComponent: () => import('./features/profile/onboarding.page').then((m) => m.OnboardingPage),
  },
  {
    path: '',
    component: ShellComponent,
    canMatch: [authGuard],
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
      {
        path: 'profile',
        title: 'Hồ sơ của tôi · Dating Master',
        loadComponent: () => import('./features/profile/profile.page').then((m) => m.ProfilePage),
      },
      {
        path: 'admin/users',
        title: 'Người dùng · Dating Master',
        canMatch: [adminGuard],
        loadComponent: () => import('./features/admin/user-list.page').then((m) => m.UserListPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
