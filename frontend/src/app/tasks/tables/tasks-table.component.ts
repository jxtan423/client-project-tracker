import { Component, Input, Output, EventEmitter } from "@angular/core";
import { Task } from "../../core/task-api.service";
@Component({
  selector: "app-tasks-table",
  templateUrl: "./tasks-table.component.html",
})
export class TasksTableComponent {
  @Input() tasks: Task[] = [];
  @Input() projectName = "";
  @Output() complete = new EventEmitter<Task>();
  @Output() edit = new EventEmitter<Task>();
  @Output() remove = new EventEmitter<Task>();
}
