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
import { ProjectApiService } from "../core/project-api.service";
import { Project } from "../core/project.model";
import { Task, TaskInput, TaskApiService } from "../core/task-api.service";
import { apiError } from "../core/api-error";
import { ToastService } from "../shared/toast.service";
import { ConfirmDialogComponent } from "../shared/confirm-dialog.component";
import { TaskFormDialogComponent } from "./task-form-dialog.component";
import { TasksTableComponent } from "./tasks-table.component";
@Component({
  selector: "app-tasks-page",
  imports: [
    RouterLink,
    ConfirmDialogComponent,
    TaskFormDialogComponent,
    TasksTableComponent,
  ],
  template: `
    <a class="back-link" routerLink="/projects">← Back to projects</a>
    @if (project(); as p) {
      <div class="page-heading">
        <div>
          <p class="eyebrow">PROJECT WORKSPACE</p>
          <h1>{{ p.name }}</h1>
          <p class="page-description">{{ p.clientName }} / Tasks</p>
        </div>
        <button
          class="button button-primary"
          [disabled]="loading() || !!error()"
          (click)="openForm(null)"
        >
          + Create task
        </button>
      </div>
    }
    @if (error()) {
      <div class="error-banner" role="alert">
        {{ error() }}
        <button class="button button-secondary" (click)="reload.next()">
          Retry
        </button>
      </div>
    }
    @if (loading()) {
      <p role="status">Loading tasks…</p>
    } @else if (project(); as p) {
      @if (!error()) {
        <section class="surface">
          <header class="section-heading">
            <h2>Project tasks ({{ tasks().length }})</h2>
            <button class="button button-secondary" (click)="reload.next()">
              Refresh
            </button>
          </header>
          <app-tasks-table
            [tasks]="tasks()"
            [projectName]="p.name"
            (edit)="openForm($event)"
            (remove)="openDelete($event)"
          />
        </section>
      }
      <p class="field-hint">
        Assignment and filtering will be added in later steps.
      </p>
    }
    @if (formOpen()) {
      <app-task-form-dialog
        [task]="editing()"
        [busy]="busy()"
        [error]="dialogError()"
        (saved)="save($event)"
        (dismissed)="closeDialogs()"
      />
    }
    @if (deleting(); as task) {
      <app-confirm-dialog
        title="Delete task?"
        confirmLabel="Delete task"
        [message]="
          'Permanently delete “' + task.title + '”? This cannot be undone.'
        "
        [busy]="busy()"
        [error]="dialogError()"
        (confirmed)="remove(task)"
        (dismissed)="closeDialogs()"
      />
    }
  `,
})
export class TasksPageComponent {
  readonly project = signal<Project | null>(null);
  readonly tasks = signal<Task[]>([]);
  readonly loading = signal(true);
  readonly error = signal("");
  readonly formOpen = signal(false);
  readonly editing = signal<Task | null>(null);
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
    }
  }
  save(input: TaskInput) {
    const p = this.project();
    if (!p || this.busy()) return;
    const task = this.editing();
    this.mutate(
      task
        ? this.api.update(p.id, task.id, input)
        : this.api.create(p.id, input),
      "Task saved.",
    );
  }
  remove(task: Task) {
    const p = this.project();
    if (p && !this.busy())
      this.mutate(this.api.delete(p.id, task.id), "Task deleted.");
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
          this.toast.success(message);
          this.reload.next();
        },
        error: (e) => {
          const details = apiError(e);
          const message =
            e.status === 404
              ? "This task or project no longer exists. Close this dialog and refresh."
              : details.message;
          this.dialogError.set(message);
          this.toast.error(message);
        },
      });
  }
}
