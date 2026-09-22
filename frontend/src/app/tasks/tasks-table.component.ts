import { Component, Input, Output, EventEmitter } from "@angular/core";
import { Task } from "../core/task-api.service";
@Component({
  selector: "app-tasks-table",
  template: ` <div
    class="table-wrap"
    tabindex="0"
    role="region"
    aria-label="Tasks; scroll horizontally for more columns"
  >
    <table class="data-table">
      <thead>
        <tr>
          <th>Task title</th>
          <th>Project</th>
          <th>Status</th>
          <th>Assignee</th>
          <th>Due date</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        @for (task of tasks; track task.id) {
          <tr>
            <td>{{ task.title }}</td>
            <td>{{ projectName }}</td>
            <td>
              <span [class]="'status-badge ' + task.status">{{
                task.status === "todo"
                  ? "To do"
                  : task.status === "in_progress"
                    ? "In progress"
                    : "Completed"
              }}</span>
            </td>
            <td>
              {{
                task.assigneeId === null
                  ? "Unassigned"
                  : "Member #" + task.assigneeId
              }}
            </td>
            <td>{{ task.dueDate ?? "—" }}</td>
            <td>
              <button
                class="button button-secondary"
                (click)="edit.emit(task)"
                [attr.aria-label]="'Edit ' + task.title"
              >
                Edit
              </button>
              <button
                class="button button-danger"
                (click)="remove.emit(task)"
                [attr.aria-label]="'Delete ' + task.title"
              >
                Delete
              </button>
            </td>
          </tr>
        } @empty {
          <tr>
            <td colspan="6">
              <div class="empty-state">
                <h3>No tasks yet</h3>
                <p>Create the first task for this project.</p>
              </div>
            </td>
          </tr>
        }
      </tbody>
    </table>
  </div>`,
})
export class TasksTableComponent {
  @Input() tasks: Task[] = [];
  @Input() projectName = "";
  @Output() edit = new EventEmitter<Task>();
  @Output() remove = new EventEmitter<Task>();
}
