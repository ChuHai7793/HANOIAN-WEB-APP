import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoginPromptComponent } from './shared/ui/login-prompt.component';
import { ConflictDialogComponent } from './shared/ui/conflict-dialog.component';
import { ToastHostComponent } from './shared/ui/toast-host.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastHostComponent, ConflictDialogComponent, LoginPromptComponent],
  template: '<router-outlet /><app-conflict-dialog /><app-login-prompt /><app-toast-host />',
})
export class App {}
