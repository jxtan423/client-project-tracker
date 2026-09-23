import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import { Project } from "../../core/project.model";

@Component({
  selector: "app-projects-table",
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./projects-table.component.html",
  styleUrl: "./projects-table.component.css",
})
export class ProjectsTableComponent {
  readonly projects = input.required<Project[]>();
  readonly complete = output<Project>();
  readonly edit = output<Project>();
  readonly delete = output<Project>();

  statusLabel(status: Project["status"]): string {
    return {
      planned: "Planned",
      in_progress: "In progress",
      completed: "Completed",
    }[status];
  }
}
