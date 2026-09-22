import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ToastService } from './shared/toast.service';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet],
  template: `
    <a class="skip-link" href="#main-content" (click)="$event.preventDefault(); mainContent.focus()">Skip to content</a>
    <header class="app-header">
      <a routerLink="/projects" class="brand" aria-label="Client Project Tracker home"><span class="brand-mark" aria-hidden="true">c<span>p</span></span><span>Client Project Tracker<small>YOUR WORK, IN ONE PLACE</small></span></a>
      <div class="workspace-label"><span class="workspace-dot"></span>Local workspace</div>
    </header>
    <nav class="app-nav" aria-label="Main navigation"><a routerLink="/projects" class="nav-link">Projects</a><span class="nav-context">Plan. Organize. Deliver.</span></nav>
    <main #mainContent id="main-content" tabindex="-1"><router-outlet /></main>
    <footer class="app-footer"><span>Client Project Tracker</span><span>A little structure. A lot of progress.</span></footer>
    <div class="toast-stack" aria-live="polite" aria-atomic="false">
      @for (toast of toasts.messages(); track toast.id) {
        <div class="toast" [class.toast-error]="toast.kind === 'error'" [attr.role]="toast.kind === 'error' ? 'alert' : 'status'">
          <span class="toast-symbol" aria-hidden="true">{{ toast.kind === 'success' ? '✓' : '!' }}</span>
          <span>{{ toast.message }}</span><button type="button" class="icon-button" aria-label="Dismiss notification" (click)="toasts.dismiss(toast.id)">×</button>
        </div>
      }
    </div>
  `,
})
export class App { readonly toasts = inject(ToastService); }
