import { BadRequestException, PipeTransform } from '@nestjs/common';

export const PROJECT_STATUSES = ['planned', 'in_progress', 'completed'] as const;
export type ProjectStatus = typeof PROJECT_STATUSES[number];

export interface CreateProjectDto {
  name: string;
  clientName: string;
  status: ProjectStatus;
  startDate: string;
}

export type UpdateProjectDto = Partial<CreateProjectDto>;

export interface Project extends CreateProjectDto {
  id: number;
  createdAt: Date;
  updatedAt: Date;
}

function invalid(errors: Record<string, string[]>): never {
  throw new BadRequestException({
    statusCode: 400,
    message: 'Please correct the highlighted fields.',
    errors,
  });
}

// Calendar validation avoids Date parsing/normalization and local timezone conversion.
function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

/** Validates and normalizes JSON at the HTTP boundary; services receive typed data. */
export class ProjectBodyPipe implements PipeTransform<unknown, UpdateProjectDto> {
  constructor(private readonly partial: boolean = false) {}

  transform(value: unknown): UpdateProjectDto {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return invalid({ body: ['Send a JSON object.'] });
    }

    const input = value as Record<string, unknown>;
    const errors: Record<string, string[]> = Object.create(null);
    const output: UpdateProjectDto = {};
    const allowedFields = ['name', 'clientName', 'status', 'startDate'];
    for (const key of Object.keys(input)) {
      if (!allowedFields.includes(key)) errors[key] = ['This field is not allowed.'];
    }
    if (this.partial && Object.keys(input).length === 0) {
      errors.body = ['Provide at least one field to update.'];
    }

    for (const field of ['name', 'clientName'] as const) {
      if (this.partial && !Object.hasOwn(input, field)) continue;
      const fieldValue = input[field];
      if (typeof fieldValue !== 'string' || fieldValue.trim().length === 0 || [...fieldValue.trim()].length > 200 || fieldValue.includes('\u0000')) {
        errors[field] = ['Enter a nonblank string of at most 200 characters without null bytes.'];
      } else {
        output[field] = fieldValue.trim();
      }
    }

    if (Object.hasOwn(input, 'status')) {
      if (typeof input.status !== 'string' || !PROJECT_STATUSES.includes(input.status as ProjectStatus)) {
        errors.status = ['Choose planned, in_progress, or completed.'];
      } else {
        output.status = input.status as ProjectStatus;
      }
    } else if (!this.partial) {
      output.status = 'planned';
    }

    if (!this.partial || Object.hasOwn(input, 'startDate')) {
      if (!isCalendarDate(input.startDate)) {
        errors.startDate = ['Enter a valid calendar date in YYYY-MM-DD format (year 0001–9999).'];
      } else {
        output.startDate = input.startDate;
      }
    }

    if (Object.keys(errors).length > 0) return invalid(errors);
    return output;
  }
}

export class ProjectIdPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    if (!/^[1-9]\d*$/.test(value) || Number(value) > 2147483647) {
      return invalid({ id: ['Use a positive integer between 1 and 2147483647.'] });
    }
    return Number(value);
  }
}
