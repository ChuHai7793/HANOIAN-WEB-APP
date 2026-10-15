import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
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
    // Khung app mở cho khách (xem quán, chỗ chơi, quiz, thử Autoplan, plan công khai); trang cần tài
    // khoản tự có authGuard
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: () => (inject(AuthService).isLoggedIn() ? 'places' : 'explore'),
      },
      {
        path: 'places',
        title: 'My place · HANOIVIBE',
        canMatch: [authGuard],
        loadComponent: () => import('./features/places/place-list.component').then((m) => m.PlaceListComponent),
      },
      // Link cũ của 3 mục My place riêng: chuyển sang My place, chọn sẵn loại
      { path: 'cafes', redirectTo: '/places?type=cafe' },
      { path: 'bars', redirectTo: '/places?type=bar' },
      { path: 'restaurants', redirectTo: '/places?type=restaurant' },
      {
        path: 'girlfriends',
        title: 'Người yêu · HANOIVIBE',
        canMatch: [authGuard],
        loadComponent: () =>
          import('./features/girlfriends/girlfriend-list.page').then((m) => m.GirlfriendListPage),
      },
      {
        path: 'girlfriends/:id',
        title: 'Chi tiết · HANOIVIBE',
        canMatch: [authGuard],
        loadComponent: () =>
          import('./features/girlfriends/girlfriend-detail.page').then(
            (m) => m.GirlfriendDetailPage,
          ),
      },
      {
        path: 'quiz',
        title: 'Gu hẹn hò của bạn · HANOIVIBE',
        loadComponent: () => import('./features/quiz/quiz.page').then((m) => m.QuizPage),
      },
      {
        path: 'autoplan',
        title: 'Autoplan · HANOIVIBE',
        loadComponent: () => import('./features/plans/autoplan-preview.page').then((m) => m.AutoplanPreviewPage),
      },
      {
        path: 'p/:token',
        title: 'Plan hẹn hò · HANOIVIBE',
        loadComponent: () => import('./features/plans/public-plan.page').then((m) => m.PublicPlanPage),
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
        path: 'quan/:slug',
        data: { kind: 'place' },
        loadComponent: () => import('./features/venue/venue.page').then((m) => m.VenuePage),
      },
      {
        path: 'cho-choi/:slug',
        data: { kind: 'spot' },
        loadComponent: () => import('./features/venue/venue.page').then((m) => m.VenuePage),
      },
      {
        path: 'cam-nang',
        loadComponent: () => import('./features/articles/article-list.page').then((m) => m.ArticleListPage),
      },
      {
        path: 'cam-nang/:slug',
        loadComponent: () => import('./features/articles/article.page').then((m) => m.ArticlePage),
      },
      {
        path: 'admin/articles',
        title: 'Bài viết Cẩm nang · HANOIVIBE',
        canMatch: [adminGuard],
        loadComponent: () => import('./features/articles/article-admin-list.page').then((m) => m.ArticleAdminListPage),
      },
      {
        path: 'admin/articles/:id',
        title: 'Soạn bài · HANOIVIBE',
        canMatch: [adminGuard],
        loadComponent: () => import('./features/articles/article-editor.page').then((m) => m.ArticleEditorPage),
      },
      {
        path: 'dating',
        title: 'Tìm đối tượng · HANOIVIBE',
        canMatch: [authGuard],
        loadComponent: () => import('./features/dating/dating.page').then((m) => m.DatingPage),
      },
      {
        path: 'plans',
        title: 'Plan · HANOIVIBE',
        canMatch: [authGuard],
        loadComponent: () => import('./features/plans/plan-list.page').then((m) => m.PlanListPage),
      },
      {
        path: 'plans/:id',
        title: 'Plan · HANOIVIBE',
        canMatch: [authGuard],
        loadComponent: () => import('./features/plans/plan-detail.page').then((m) => m.PlanDetailPage),
      },
      {
        path: 'dating/matches/:id',
        title: 'Nhắn tin · HANOIVIBE',
        canMatch: [authGuard],
        loadComponent: () => import('./features/dating/chat.page').then((m) => m.ChatPage),
      },
      {
        path: 'profile',
        title: 'Hồ sơ của tôi · HANOIVIBE',
        canMatch: [authGuard],
        loadComponent: () => import('./features/profile/profile.page').then((m) => m.ProfilePage),
      },
      // Trang cũ "Quản trị Tìm đối tượng" đã gộp vào "Người dùng"
      { path: 'admin/dating', redirectTo: 'admin/users' },
      {
        path: 'admin/users',
        title: 'Người dùng · HANOIVIBE',
        canMatch: [adminGuard],
        loadComponent: () => import('./features/admin/admin-users.page').then((m) => m.AdminUsersPage),
      },
      {
        path: 'admin/users/:id',
        title: 'Chi tiết người dùng · HANOIVIBE',
        canMatch: [adminGuard],
        loadComponent: () => import('./features/admin/admin-user-detail.page').then((m) => m.AdminUserDetailPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
