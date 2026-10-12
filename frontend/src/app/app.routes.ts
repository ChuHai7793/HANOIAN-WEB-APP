import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell.component';
import { adminGuard, authGuard, guestGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Đăng nhập · HANOIVIBE',
    canMatch: [guestGuard],
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    title: 'Đăng ký · HANOIVIBE',
    canMatch: [guestGuard],
    loadComponent: () => import('./features/auth/register.page').then((m) => m.RegisterPage),
  },
  {
    path: 'onboarding',
    title: 'Hoàn thiện hồ sơ · HANOIVIBE',
    canMatch: [authGuard],
    loadComponent: () => import('./features/profile/onboarding.page').then((m) => m.OnboardingPage),
  },
  {
    path: '',
    component: ShellComponent,
    canMatch: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'places' },
      {
        path: 'places',
        title: 'My place · HANOIVIBE',
        loadComponent: () => import('./features/places/place-list.component').then((m) => m.PlaceListComponent),
      },
      // Link cũ của 3 mục My place riêng: chuyển sang My place, chọn sẵn loại
      { path: 'cafes', redirectTo: '/places?type=cafe' },
      { path: 'bars', redirectTo: '/places?type=bar' },
      { path: 'restaurants', redirectTo: '/places?type=restaurant' },
      {
        path: 'girlfriends',
        title: 'Người yêu · HANOIVIBE',
        loadComponent: () =>
          import('./features/girlfriends/girlfriend-list.page').then((m) => m.GirlfriendListPage),
      },
      {
        path: 'girlfriends/:id',
        title: 'Chi tiết · HANOIVIBE',
        loadComponent: () =>
          import('./features/girlfriends/girlfriend-detail.page').then(
            (m) => m.GirlfriendDetailPage,
          ),
      },
      {
        path: 'explore',
        title: 'Khám phá quán · HANOIVIBE',
        loadComponent: () => import('./features/explore/explore.page').then((m) => m.ExplorePage),
      },
      {
        path: 'spots',
        title: 'Tìm chỗ chơi · HANOIVIBE',
        loadComponent: () => import('./features/spots/spot-list.page').then((m) => m.SpotListPage),
      },
      {
        path: 'dating',
        title: 'Tìm đối tượng · HANOIVIBE',
        loadComponent: () => import('./features/dating/dating.page').then((m) => m.DatingPage),
      },
      {
        path: 'plans',
        title: 'Plan · HANOIVIBE',
        loadComponent: () => import('./features/plans/plan-list.page').then((m) => m.PlanListPage),
      },
      {
        path: 'plans/:id',
        title: 'Plan · HANOIVIBE',
        loadComponent: () => import('./features/plans/plan-detail.page').then((m) => m.PlanDetailPage),
      },
      {
        path: 'dating/matches/:id',
        title: 'Nhắn tin · HANOIVIBE',
        loadComponent: () => import('./features/dating/chat.page').then((m) => m.ChatPage),
      },
      {
        path: 'profile',
        title: 'Hồ sơ của tôi · HANOIVIBE',
        loadComponent: () => import('./features/profile/profile.page').then((m) => m.ProfilePage),
      },
      {
        path: 'admin/dating',
        title: 'Quản trị Tìm đối tượng · HANOIVIBE',
        canMatch: [adminGuard],
        loadComponent: () => import('./features/admin/dating-admin.page').then((m) => m.DatingAdminPage),
      },
      {
        path: 'admin/users',
        title: 'Người dùng · HANOIVIBE',
        canMatch: [adminGuard],
        loadComponent: () => import('./features/admin/user-list.page').then((m) => m.UserListPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
