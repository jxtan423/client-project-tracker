import { Component, ElementRef, EventEmitter, Input, Output, afterNextRender, viewChild } from '@angular/core';

@Component({
  selector: 'app-dialog',
  templateUrl: './dialog.component.html',
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
