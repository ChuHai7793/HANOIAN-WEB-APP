import { Component } from '@angular/core';
import { ProfileFormComponent } from './profile-form.component';
import { IconComponent } from '../../shared/ui/icon.component';

/** "Hồ sơ của tôi": xem và sửa hồ sơ cá nhân bất cứ lúc nào. */
@Component({
  selector: 'app-profile-page',
  imports: [ProfileFormComponent, IconComponent],
  template: `
    <div class="p-4 sm:p-5 lg:p-6">
      <div class="mb-6">
        <h1 class="flex items-center gap-2 text-xl font-bold text-slate-900">
          <span class="text-brand-600"><app-icon name="smile" [size]="24" /></span> Hồ sơ của tôi
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
