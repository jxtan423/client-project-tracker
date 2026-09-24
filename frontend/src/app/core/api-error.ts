import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';

export function isVersionConflict(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 409
    && error.error?.code === 'VERSION_CONFLICT';
}

export const EDIT_CONFLICT_MESSAGE = 'Someone changed this record while you were editing. Your input is still here. Copy any changes you want to keep, then close and reopen Edit to load the latest version.';

export function apiError(error: unknown): { message: string; fields: Record<string, string[]> } {
  if (error instanceof TimeoutError) {
    return { message: 'The request took too long. Refresh the list before retrying a save.', fields: {} };
  }
  if (!(error instanceof HttpErrorResponse)) {
    return { message: 'Something went wrong. Please try again.', fields: {} };
  }
  if (error.status === 0) {
    return { message: 'Cannot reach the server. Check your connection and try again.', fields: {} };
  }
  if (error.status === 403) {
    return { message: 'You do not have permission to perform this action. Your access may have changed.', fields: {} };
  }
  const body = error.error;
  const fields: Record<string, string[]> = Object.create(null);
  if (body && typeof body === 'object' && body.errors && typeof body.errors === 'object') {
    for (const [key, value] of Object.entries(body.errors)) {
      if (Array.isArray(value)) fields[key] = value.filter((message): message is string => typeof message === 'string');
    }
  }
  const message = error.status === 404 ? 'This project is no longer available. Refresh the project list.'
    : error.status >= 500 ? 'The server could not complete the request. Please try again.'
    : typeof body?.message === 'string' ? body.message : 'Unable to complete the request. Please try again.';
  return { message, fields };
}
