import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of, Subject, switchMap, tap } from 'rxjs';
import { apiError } from '../../core/api-error';
import { ProjectApiService } from '../../core/project-api.service';
import { Project, ProjectInput } from '../../core/project.model';
import { ConfirmDialogComponent } from '../../shared/dialogs/confirm-dialog.component';
import { ToastService } from '../../shared/toast.service';
import { ProjectFormDialogComponent } from '../dialogs/project-form-dialog.component';
import { ProjectsTableComponent } from '../tables/projects-table.component';

@Component({
  selector: 'app-projects-page',
  imports: [ProjectsTableComponent, ProjectFormDialogComponent, ConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './projects-page.component.html',
  styleUrl: './projects-page.component.css',
})
export class ProjectsPageComponent {
  private readonly api = inject(ProjectApiService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload = new Subject<void>();

  readonly projects = signal<Project[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly formOpen = signal(false);
  readonly editingProject = signal<Project | null>(null);
  readonly saving = signal(false);
  readonly saveError = signal('');
  readonly fieldErrors = signal<Record<string, string[]>>({});
  readonly deletingProject = signal<Project | null>(null);
  readonly deleting = signal(false);
  readonly deleteError = signal('');

  constructor() {
    // A later refresh cancels an earlier request, so stale lists cannot win a race.
    this.reload.pipe(
      tap(() => { this.loading.set(true); this.loadError.set(''); }),
      switchMap(() => this.api.list().pipe(
        catchError(error => {
          this.loadError.set(apiError(error).message);
          return of([] as Project[]);
        }),
      )),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(projects => {
      this.projects.set(projects);
      this.loading.set(false);
    });
    this.refresh();
  }

  refresh(): void {
    this.reload.next();
  }

  createProject(): void {
    this.openForm(null);
  }

  editProject(project: Project): void {
    this.openForm(project);
  }

  private openForm(project: Project | null): void {
    if (this.saving() || this.deleting()) return;
    this.editingProject.set(project);
    this.saveError.set('');
    this.fieldErrors.set({});
    this.formOpen.set(true);
  }

  dismissForm(): void {
    if (!this.saving()) this.formOpen.set(false);
  }

  saveProject(input: ProjectInput): void {
    if (this.saving()) return;
    const project = this.editingProject();
    this.saving.set(true);
    this.saveError.set('');
    this.fieldErrors.set({});
    const request = project ? this.api.update(project.id, input) : this.api.create(input);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.toast.success(project ? 'Project updated.' : 'Project created.');
        this.refresh();
      },
      error: error => {
        this.saving.set(false);
        const failure = apiError(error);
        let message = failure.message;
        if (error instanceof HttpErrorResponse && error.status === 404) {
          message = 'This project no longer exists. Your input is still here; the project list is being refreshed.';
          this.refresh();
        } else if (!project && error instanceof HttpErrorResponse && error.status === 0) {
          message = 'The save could not be confirmed. Close this dialog and refresh the list before trying again; the project may have been created.';
        }
        this.saveError.set(message);
        this.fieldErrors.set(failure.fields);
        this.toast.error(message);
      },
    });
  }

  confirmDelete(project: Project): void {
    if (this.saving() || this.deleting()) return;
    this.deleteError.set('');
    this.deletingProject.set(project);
  }

  dismissDelete(): void {
    if (!this.deleting()) this.deletingProject.set(null);
  }

  deleteProject(): void {
    const project = this.deletingProject();
    if (!project || this.deleting()) return;
    this.deleting.set(true);
    this.deleteError.set('');
    this.api.delete(project.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deletingProject.set(null);
        this.toast.success('Project deleted.');
        this.refresh();
      },
      error: error => {
        this.deleting.set(false);
        let message = apiError(error).message;
        if (error instanceof HttpErrorResponse && error.status === 404) {
          message = 'This project has already been deleted. Close this dialog to see the refreshed list.';
          this.refresh();
        }
        this.deleteError.set(message);
        this.toast.error(message);
      },
    });
  }
}
