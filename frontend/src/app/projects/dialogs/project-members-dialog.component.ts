import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, forkJoin } from 'rxjs';
import { apiError } from '../../core/api-error';
import { Project } from '../../core/project.model';
import { ProjectMembersApiService } from '../../core/project-members-api.service';
import { AppUser } from '../../core/user.model';
import { DialogComponent } from '../../shared/dialogs/dialog.component';
import { ToastService } from '../../shared/toast.service';

@Component({
  selector: 'app-project-members-dialog',
  imports: [DialogComponent, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-members-dialog.component.html',
  styleUrl: './project-members-dialog.component.css',
})
export class ProjectMembersDialogComponent implements OnInit {
  readonly project = input.required<Project>();
  readonly dismissed = output<void>();
  readonly members = signal<AppUser[]>([]);
  private readonly users = signal<AppUser[]>([]);
  readonly availableUsers = computed(() => {
    const memberIds = new Set(this.members().map(member => member.id));
    return this.users().filter(user => user.role !== 'admin' && !memberIds.has(user.id));
  });
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly mutationError = signal('');
  readonly pendingAction = signal<'add' | 'remove' | null>(null);
  readonly removingUserId = signal<number | null>(null);
  readonly busy = computed(() => this.pendingAction() !== null);
  selectedUserId: number | null = null;

  private readonly api = inject(ProjectMembersApiService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    if (this.busy()) return;
    this.loading.set(true);
    this.loadError.set('');
    this.mutationError.set('');
    forkJoin({ users: this.api.listUsers(), members: this.api.listMembers(this.project().id) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ users, members }) => {
          this.users.set(users);
          this.members.set(members);
          if (!this.availableUsers().some(user => user.id === this.selectedUserId)) this.selectedUserId = null;
          this.loading.set(false);
        },
        error: error => {
          this.loading.set(false);
          this.loadError.set(apiError(error).message);
        },
      });
  }

  addMember(): void {
    if (this.loading() || this.busy() || this.loadError()) return;
    const user = this.availableUsers().find(candidate => candidate.id === this.selectedUserId);
    if (!user) {
      this.mutationError.set('Choose an existing user to add.');
      return;
    }
    this.pendingAction.set('add');
    this.mutate(this.api.addMember(this.project().id, user.id), `${user.name} added to the project.`);
  }

  removeMember(member: AppUser): void {
    if (this.loading() || this.busy() || this.loadError() || member.id === this.project().createdBy) return;
    this.pendingAction.set('remove');
    this.removingUserId.set(member.id);
    this.mutate(this.api.removeMember(this.project().id, member.id), `${member.name} removed from the project.`);
  }

  close(): void {
    if (!this.busy()) this.dismissed.emit();
  }

  private mutate(request: Observable<unknown>, successMessage: string): void {
    this.mutationError.set('');
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.pendingAction.set(null);
        this.removingUserId.set(null);
        this.selectedUserId = null;
        this.toast.success(successMessage);
        this.load();
      },
      error: error => {
        this.pendingAction.set(null);
        this.removingUserId.set(null);
        const message = apiError(error).message;
        // Stop showing actionable stale data when administrator access was removed.
        if (error instanceof HttpErrorResponse && error.status === 403) this.loadError.set(message);
        else this.mutationError.set(message);
        this.toast.error(message);
      },
    });
  }
}
