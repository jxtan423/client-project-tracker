import { ValidatorFn } from '@angular/forms';
import { isCalendarDate, projectTextError } from './project-validation';

export const textValidator: ValidatorFn = control => {
  const message = projectTextError(control.value ?? '');
  return message ? { projectText: message } : null;
};

export const projectStatusValidator: ValidatorFn = control =>
  ['planned', 'in_progress', 'completed'].includes(control.value) ? null : { status: true };

export const calendarDateValidator: ValidatorFn = control =>
  isCalendarDate(control.value) ? null : { calendarDate: true };
