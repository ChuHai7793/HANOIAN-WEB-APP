import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ProfileFormComponent } from './profile-form.component';

/** Ngay sau khi đăng ký: mời nhập hồ sơ. Có thể "Để sau" và bổ sung ở "Hồ sơ của tôi". */
@Component({
  selector: 'app-onboarding-page',
  imports: [ProfileFormComponent],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div class="w-full max-w-xl">
        <div class="mb-6 text-center">
          <p class="text-4xl">👋</p>
          <h1 class="mt-2 text-2xl font-bold text-slate-900">Hoàn thiện hồ sơ</h1>
          <p class="mt-1 text-sm text-slate-500">
            Thêm ảnh và vài thông tin về bạn. Có thể bổ sung sau ở mục "Hồ sơ của tôi".
          </p>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <app-profile-form [skippable]="true" (done)="finish()" />
        </div>
      </div>
    </div>
  `,
})
export class OnboardingPage {
  private readonly router = inject(Router);

  protected finish(): void {
    void this.router.navigateByUrl('/');
  }
}
