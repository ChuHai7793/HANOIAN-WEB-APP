import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConflictDialogComponent } from './shared/ui/conflict-dialog.component';
import { ToastHostComponent } from './shared/ui/toast-host.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastHostComponent, ConflictDialogComponent],
  template: '<router-outlet /><app-conflict-dialog /><app-toast-host />',
})
export class App {}
