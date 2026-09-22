import { Component, ElementRef, EventEmitter, Input, Output, afterNextRender, viewChild } from '@angular/core';

@Component({
  selector: 'app-dialog',
  template: `
    <dialog #dialog class="dialog" aria-labelledby="dialog-title" (cancel)="cancel($event)">
      <header class="dialog-header">
        <div><h2 id="dialog-title">{{ title }}</h2>@if (subtitle) { <p>{{ subtitle }}</p> }</div>
        <button type="button" class="icon-button" aria-label="Close dialog" [disabled]="busy" (click)="dismissed.emit()">×</button>
      </header>
      <ng-content />
    </dialog>
  `,
})
export class DialogComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() busy = false;
  @Output() dismissed = new EventEmitter<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    // Native modal dialogs provide focus trapping and background inertness.
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }

  cancel(event: Event) {
    event.preventDefault();
    if (!this.busy) this.dismissed.emit();
  }
}
