import { Component, Input, Output, EventEmitter, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { DialogComponent } from "../shared/dialog.component";
import { Task, TaskInput } from "../core/task-api.service";
import {
  projectTextError,
  isCalendarDate,
} from "../projects/project-validation";
@Component({
  selector: "app-task-form-dialog",
  imports: [FormsModule, DialogComponent],
  template: ` <app-dialog
    [title]="task ? 'Edit task' : 'Create task'"
    [busy]="busy"
    (dismissed)="dismissed.emit()"
  >
    <form (ngSubmit)="submit()" novalidate>
      <div class="dialog-body">
        @if (error) {
          <p class="error-banner" role="alert">{{ error }}</p>
        }
        <label class="field"
          >Task title *<input
            name="title"
            [(ngModel)]="title"
            [disabled]="busy"
            required
        /></label>
        @if (validation) {
          <p class="field-error" role="alert">{{ validation }}</p>
        }
        <label class="field"
          >Status<select name="status" [(ngModel)]="status" [disabled]="busy">
            <option value="todo">To do</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
          </select></label
        >
        <label class="field"
          >Due date<input
            name="dueDate"
            type="date"
            [(ngModel)]="dueDate"
            [disabled]="busy"
            min="0001-01-01"
            max="9999-12-31"
        /></label>
        <p class="field-hint">
          Leave the date empty if there is no deadline. Assignment will be
          available in the member-management step.
        </p>
      </div>
      <footer class="dialog-actions">
        <button
          type="button"
          class="button button-secondary"
          [disabled]="busy"
          (click)="dismissed.emit()"
        >
          Cancel</button
        ><button type="submit" class="button button-primary" [disabled]="busy">
          {{ busy ? "Saving…" : "Save task" }}
        </button>
      </footer>
    </form></app-dialog
  >`,
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
