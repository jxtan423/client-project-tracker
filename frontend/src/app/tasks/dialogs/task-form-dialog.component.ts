import { Component, Input, Output, EventEmitter, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { DialogComponent } from "../../shared/dialogs/dialog.component";
import { Task, TaskInput } from "../../core/task-api.service";
import {
  projectTextError,
  isCalendarDate,
} from "../../shared/validation/project-validation";
@Component({
  selector: "app-task-form-dialog",
  imports: [FormsModule, DialogComponent],
  templateUrl: './task-form-dialog.component.html',
})
export class TaskFormDialogComponent implements OnInit {
  @Input() task: Task | null = null;
  @Input() busy = false;
  @Input() error = "";
  @Output() saved = new EventEmitter<TaskInput>();
  @Output() dismissed = new EventEmitter<void>();
  title = "";
  status: TaskInput["status"] = "todo";
  dueDate = "";
  validation = "";
  ngOnInit() {
    if (this.task) {
      this.title = this.task.title;
      this.status = this.task.status;
      this.dueDate = this.task.dueDate ?? "";
    }
  }
  submit() {
    if (this.busy) return;
    this.validation =
      projectTextError(this.title) ??
      (this.dueDate && !isCalendarDate(this.dueDate)
        ? "Enter a real due date."
        : "");
    if (!this.validation)
      this.saved.emit({
        title: this.title.trim(),
        status: this.status,
        dueDate: this.dueDate || null,
      });
  }
}
