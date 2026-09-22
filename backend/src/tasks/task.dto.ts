import { BadRequestException, PipeTransform } from "@nestjs/common";
import { isCalendarDate } from "../projects/project.dto";
export interface TaskInput {
  title: string;
  status: "todo" | "in_progress" | "completed";
  dueDate: string | null;
}
export class TaskBodyPipe implements PipeTransform {
  constructor(private readonly partial = false) {}
  transform(value: unknown): Partial<TaskInput> {
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
      output: Partial<TaskInput> = {};
    for (const key of Object.keys(input))
      if (!["title", "status", "dueDate"].includes(key))
        errors[key] = ["This field is not allowed."];
    if (this.partial && !Object.keys(input).length)
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
