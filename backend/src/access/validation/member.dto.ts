import { BadRequestException, PipeTransform } from '@nestjs/common';

export interface AddMemberDto { userId: number }
export class MemberBodyPipe implements PipeTransform<unknown, AddMemberDto> {
  transform(value: unknown): AddMemberDto {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).some(key => key !== 'userId') ||
        !Number.isInteger((value as AddMemberDto).userId) ||
        (value as AddMemberDto).userId < 1 || (value as AddMemberDto).userId > 2147483647) {
      throw new BadRequestException({ statusCode: 400, message: 'Choose a valid user.', errors: { userId: ['Send only a positive integer userId.'] } });
    }
    return { userId: (value as AddMemberDto).userId };
  }
}
