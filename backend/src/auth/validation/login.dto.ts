import { BadRequestException, PipeTransform } from '@nestjs/common';

export interface LoginDto { username: string; password: string }

export class LoginBodyPipe implements PipeTransform<unknown, LoginDto> {
  transform(value: unknown): LoginDto {
    const errors: Record<string, string[]> = Object.create(null);
    const input = value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown> : {};
    for (const key of Object.keys(input)) {
      if (key !== 'username' && key !== 'password') errors[key] = ['This field is not allowed.'];
    }
    const username = typeof input.username === 'string' ? input.username.trim() : '';
    if (!username || [...username].length > 100 || username.includes('\u0000')) {
      errors.username = ['Enter a username of 1 to 100 characters.'];
    }
    if (typeof input.password !== 'string' || !input.password.length || Buffer.byteLength(input.password, 'utf8') > 1024) {
      errors.password = ['Enter a password of 1 to 1024 bytes.'];
    }
    if (Object.keys(errors).length) {
      throw new BadRequestException({ statusCode: 400, message: 'Please correct the highlighted fields.', errors });
    }
    return { username, password: input.password as string };
  }
}
