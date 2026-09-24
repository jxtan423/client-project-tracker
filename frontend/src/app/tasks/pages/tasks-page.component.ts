import { Component, DestroyRef, inject, signal } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  Subject,
  combineLatest,
  forkJoin,
  of,
  startWith,
  switchMap,
  catchError,
  finalize,
} from "rxjs";
import { ProjectApiService } from "../../core/project-api.service";
import { Project } from "../../core/project.model";
import { Task, TaskInput, TaskApiService } from "../../core/task-api.service";
import { apiError, EDIT_CONFLICT_MESSAGE, isVersionConflict } from "../../core/api-error";
import { ToastService } from "../../shared/toast.service";
import { ConfirmDialogComponent } from "../../shared/dialogs/confirm-dialog.component";
import { TaskFormDialogComponent } from "../dialogs/task-form-dialog.component";
import { TasksTableComponent } from "../tables/tasks-table.component";
@Component({
  selector: "app-tasks-page",
  imports: [
    RouterLink,
    ConfirmDialogComponent,
    TaskFormDialogComponent,
    TasksTableComponent,
  ],
  templateUrl: "./tasks-page.component.html",
})
export class TasksPageComponent {
  readonly project = signal<Project | null>(null);
  readonly tasks = signal<Task[]>([]);
  readonly loading = signal(true);
  readonly error = signal("");
  readonly formOpen = signal(false);
  readonly editing = signal<Task | null>(null);
  readonly completing = signal<Task | null>(null);
  readonly deleting = signal<Task | null>(null);
  readonly busy = signal(false);
  readonly dialogError = signal("");
  readonly reload = new Subject<void>();
  private readonly api = inject(TaskApiService);
  private readonly projects = inject(ProjectApiService);
  private readonly toast = inject(ToastService);
  private readonly destroy = inject(DestroyRef);
  constructor() {
    combineLatest([
      inject(ActivatedRoute).paramMap,
      this.reload.pipe(startWith(undefined)),
    ])
      .pipe(
        switchMap(([params]) => {
          this.loading.set(true);
          this.error.set("");
          const id = params.get("id") ?? "";
          if (!/^[1-9]\d*$/.test(id) || Number(id) > 2147483647) {
            this.project.set(null);
            this.loading.set(false);
            this.error.set("This project link is invalid.");
            return of(null);
          }
          if (this.project()?.id !== Number(id)) {
            this.project.set(null);
            this.formOpen.set(false);
            this.deleting.set(null);
            this.completing.set(null);
          }
          return forkJoin({
            project: this.projects.get(Number(id)),
            tasks: this.api.list(Number(id)),
          }).pipe(
            catchError((e) => {
              this.error.set(apiError(e).message);
              return of(null);
            }),
            finalize(() => this.loading.set(false)),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        if (result) {
          this.project.set(result.project);
          this.tasks.set(result.tasks);
        }
      });
  }
  openComplete(task: Task) {
    if (this.busy() || task.status === "completed") return;
    this.dialogError.set("");
    this.completing.set(task);
  }
  completeTask() {
    const project = this.project(),
      task = this.completing();
    if (!project || !task || this.busy()) return;
    this.mutate(
      this.api.update(project.id, task.id, task.version, { status: "completed" }),
      "Task completed.",
    );
  }
  openForm(task: Task | null) {
    this.editing.set(task);
    this.dialogError.set("");
    this.formOpen.set(true);
  }
  openDelete(task: Task) {
    this.dialogError.set("");
    this.deleting.set(task);
  }
  closeDialogs() {
    if (!this.busy()) {
      this.formOpen.set(false);
      this.deleting.set(null);
      this.completing.set(null);
    }
  }
  save(input: TaskInput) {
    const p = this.project();
    if (!p || this.busy()) return;
    const task = this.editing();
    this.mutate(
      task
        ? this.api.update(p.id, task.id, task.version, input)
        : this.api.create(p.id, input),
      "Task saved.",
    );
  }
  remove(task: Task) {
    const p = this.project();
    if (p && !this.busy())
      this.mutate(this.api.delete(p.id, task.id, task.version), "Task deleted.");
  }
  private mutate(request: import("rxjs").Observable<unknown>, message: string) {
    this.busy.set(true);
    this.dialogError.set("");
    request
      .pipe(
        takeUntilDestroyed(this.destroy),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: () => {
          this.formOpen.set(false);
          this.deleting.set(null);
          this.completing.set(null);
          this.toast.success(message);
          this.reload.next();
        },
        error: (e) => {
          const details = apiError(e);
          let message =
            e.status === 404
              ? "This task or project no longer exists. Close this dialog and refresh."
              : details.message;
          if (isVersionConflict(e)) {
            if (this.formOpen()) {
              message = EDIT_CONFLICT_MESSAGE;
              // The editing record stays unchanged when the table reloads.
            } else {
              this.deleting.set(null);
              this.completing.set(null);
            }
            this.reload.next();
          }
          this.dialogError.set(message);
          this.toast.error(message);
        },
      });
  }
}
