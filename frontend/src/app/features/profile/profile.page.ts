import { Component } from '@angular/core';
import { ProfileFormComponent } from './profile-form.component';

/** "Hồ sơ của tôi": xem và sửa hồ sơ cá nhân bất cứ lúc nào. */
@Component({
  selector: 'app-profile-page',
  imports: [ProfileFormComponent],
  template: `
    <div class="p-4 sm:p-6 lg:p-8">
      <div class="mb-6">
        <h1 class="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <span>🙂</span> Hồ sơ của tôi
        </h1>
        <p class="mt-1 text-sm text-slate-500">Ảnh đại diện và thông tin cá nhân</p>
      </div>
      <div class="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <app-profile-form />
      </div>
    </div>
  `,
})
export class ProfilePage {}
