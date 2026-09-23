import { Component, EventEmitter, Input, Output } from "@angular/core";
import { DialogComponent } from "./dialog.component";

@Component({
  selector: "app-confirm-dialog",
  imports: [DialogComponent],
  templateUrl: "./confirm-dialog.component.html",
})
export class ConfirmDialogComponent {
  @Input() destructive = true;
  @Input() busyLabel = "Deleting…";
  @Input() title = "Delete project";
  @Input() message = "";
  @Input() confirmLabel = "Delete project";
  @Input() busy = false;
  @Input() error = "";
  @Output() confirmed = new EventEmitter<void>();
  @Output() dismissed = new EventEmitter<void>();
}
