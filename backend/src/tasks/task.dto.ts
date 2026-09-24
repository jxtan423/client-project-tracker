import { BadRequestException, PipeTransform } from "@nestjs/common";
import { isCalendarDate } from "../projects/project.dto";
import { isVersion } from '../common/validation/version';
export interface TaskInput {
  title: string;
  status: "todo" | "in_progress" | "completed";
  dueDate: string | null;
}
export type UpdateTaskDto = Partial<TaskInput> & { version: number };
export class TaskBodyPipe implements PipeTransform {
  constructor(private readonly partial = false) {}
  transform(value: unknown): Partial<UpdateTaskDto> {
    const errors: Record<string, string[]> = Object.create(null);
    const fail = () => {
      throw new BadRequestException({
        statusCode: 400,
        message: "Please correct the highlighted fields.",
        errors,
      });
    };
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      errors.body = ["Send a JSON object."];
      return fail();
    }
    const input = value as Record<string, unknown>,
      output: Partial<UpdateTaskDto> = {};
    const allowedFields = ['title', 'status', 'dueDate'];
    if (this.partial) {
      allowedFields.push('version');
      if (!isVersion(input.version)) errors.version = ['Send the positive integer version of the record you opened.'];
      else output.version = input.version;
    }
    for (const key of Object.keys(input))
      if (!allowedFields.includes(key))
        errors[key] = ["This field is not allowed."];
    if (this.partial && !['title', 'status', 'dueDate'].some(field => Object.hasOwn(input, field)))
      errors.body = ["Provide at least one field."];
    if (!this.partial || Object.hasOwn(input, "title")) {
      if (
        typeof input.title !== "string" ||
        !input.title.trim() ||
        [...input.title.trim()].length > 200 ||
        input.title.includes("\u0000")
      )
        errors.title = [
          "Enter a title of 1–200 characters without null bytes.",
        ];
      else output.title = input.title.trim();
    }
    if (Object.hasOwn(input, "status")) {
      if (
        !["todo", "in_progress", "completed"].includes(input.status as string)
      )
        errors.status = ["Choose todo, in_progress, or completed."];
      else output.status = input.status as TaskInput["status"];
    } else if (!this.partial) output.status = "todo";
    if (Object.hasOwn(input, "dueDate")) {
      if (input.dueDate !== null && !isCalendarDate(input.dueDate))
        errors.dueDate = ["Enter a real YYYY-MM-DD date or null."];
      else output.dueDate = input.dueDate as string | null;
    } else if (!this.partial) output.dueDate = null;
    if (Object.keys(errors).length) return fail();
    return output;
  }
}
