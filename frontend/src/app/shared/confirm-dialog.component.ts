import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DialogComponent } from './dialog.component';

@Component({
  selector: 'app-confirm-dialog', imports: [DialogComponent],
  template: `
    <app-dialog [title]="title" [busy]="busy" (dismissed)="dismissed.emit()">
      <div class="dialog-body"><div class="delete-symbol" aria-hidden="true">!</div><p>{{ message }}</p>
      @if (error) { <p class="error-banner" role="alert">{{ error }}</p> }</div>
      <footer class="dialog-actions">
        <button type="button" class="button button-secondary" autofocus [disabled]="busy" (click)="dismissed.emit()">Cancel</button>
        <button type="button" class="button button-danger" [disabled]="busy" (click)="confirmed.emit()">{{ busy ? 'Deleting…' : confirmLabel }}</button>
      </footer>
    </app-dialog>
  `,
})
export class ConfirmDialogComponent {
  @Input() title = 'Delete project';
  @Input() message = '';
  @Input() confirmLabel = 'Delete project';
  @Input() busy = false;
  @Input() error = '';
  @Output() confirmed = new EventEmitter<void>();
  @Output() dismissed = new EventEmitter<void>();
}
