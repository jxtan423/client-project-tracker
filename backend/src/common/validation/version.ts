import { BadRequestException, PipeTransform } from '@nestjs/common';

export function isVersion(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 2147483647;
}

// DELETE carries the version in its query string, so parse only a decimal integer.
export class VersionQueryPipe implements PipeTransform<unknown, number> {
  transform(value: unknown): number {
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !isVersion(Number(value))) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'The record version is required. Refresh and try again.',
        errors: { version: ['Send a positive integer version.'] },
      });
    }
    return Number(value);
  }
}
