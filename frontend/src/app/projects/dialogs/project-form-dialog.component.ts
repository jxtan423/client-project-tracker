import { projectTextError } from '../../shared/validation/project-validation';
import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Project, ProjectInput } from '../../core/project.model';
import { DialogComponent } from '../../shared/dialogs/dialog.component';
import { textValidator, projectStatusValidator, calendarDateValidator } from '../../shared/validation/form-validators';

type Field = 'name' | 'clientName' | 'status' | 'startDate';

@Component({
  selector: 'app-project-form-dialog',
  imports: [ReactiveFormsModule, DialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-form-dialog.component.html',
  styleUrl: './project-form-dialog.component.css',
})
export class ProjectFormDialogComponent {
  readonly project = input<Project | null>(null);
  readonly saving = input(false);
  readonly errorMessage = input('');
  readonly fieldErrors = input<Record<string, string[]>>({});
  readonly saved = output<ProjectInput>();
  readonly dismissed = output<void>();
  readonly submitted = signal(false);
  private readonly correctedFields = signal<Set<Field>>(new Set());

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [textValidator] }),
    clientName: new FormControl('', { nonNullable: true, validators: [textValidator] }),
    status: new FormControl<Project['status']>('planned', {
      nonNullable: true,
      validators: [projectStatusValidator],
    }),
    startDate: new FormControl('', {
      nonNullable: true,
      validators: [calendarDateValidator],
    }),
  });

  constructor() {
    effect(() => {
      const project = this.project();
      this.form.reset({
        name: project?.name ?? '',
        clientName: project?.clientName ?? '',
        status: project?.status ?? 'planned',
        startDate: project?.startDate ?? '',
      });
      this.submitted.set(false);
    });
    effect(() => {
      if (this.saving()) this.form.disable({ emitEvent: false });
      else this.form.enable({ emitEvent: false });
    });
    effect(() => {
      this.fieldErrors();
      this.correctedFields.set(new Set());
    });
  }

  fieldError(field: Field): string {
    const control = this.form.controls[field];
    if ((control.touched || this.submitted()) && control.invalid) {
      if (field === 'name' || field === 'clientName') return projectTextError(control.value) ?? '';
      if (field === 'startDate') return control.value ? 'Enter a valid date in YYYY-MM-DD format.' : 'Start date is required.';
      return 'Choose a valid project status.';
    }
    return this.correctedFields().has(field) ? '' : (this.fieldErrors()[field]?.join(' ') ?? '');
  }

  fieldChanged(field: Field): void {
    this.correctedFields.update(fields => new Set([...fields, field]));
  }

  submit(): void {
    if (this.saving()) return;
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    this.saved.emit({ ...value, name: value.name.trim(), clientName: value.clientName.trim() });
  }
}
