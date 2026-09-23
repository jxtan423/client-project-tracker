import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { timeout } from "rxjs";
import { API_BASE_URL } from "./project-api.service";
export interface TaskInput {
  title: string;
  status: "todo" | "in_progress" | "completed";
  dueDate: string | null;
}
export interface Task extends TaskInput {
  id: number;
  projectId: number;
  assigneeId: number | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}
@Injectable({ providedIn: "root" })
export class TaskApiService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private url(p: number) {
    return `${this.base}/projects/${p}/tasks`;
  }
  list(p: number) {
    return this.http.get<Task[]>(this.url(p)).pipe(timeout(15000));
  }
  create(p: number, input: TaskInput) {
    return this.http.post<Task>(this.url(p), input).pipe(timeout(15000));
  }
  update(p: number, id: number, input: Partial<TaskInput>) {
    return this.http
      .patch<Task>(`${this.url(p)}/${id}`, input)
      .pipe(timeout(15000));
  }
  delete(p: number, id: number) {
    return this.http.delete<void>(`${this.url(p)}/${id}`).pipe(timeout(15000));
  }
}
