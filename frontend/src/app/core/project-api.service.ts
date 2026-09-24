import { HttpClient } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { timeout } from 'rxjs';
import { Project, ProjectInput } from './project.model';

export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root', factory: () => 'http://localhost:3000',
});

@Injectable({ providedIn: 'root' })
export class ProjectApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/projects`;

  list() { return this.http.get<Project[]>(this.url).pipe(timeout(15000)); }
  get(id: number) { return this.http.get<Project>(`${this.url}/${id}`).pipe(timeout(15000)); }
  create(input: ProjectInput) { return this.http.post<Project>(this.url, input).pipe(timeout(15000)); }
  update(id: number, version: number, input: Partial<ProjectInput>) {
    return this.http.patch<Project>(`${this.url}/${id}`, { ...input, version }).pipe(timeout(15000));
  }
  delete(id: number, version: number) {
    return this.http.delete<void>(`${this.url}/${id}`, { params: { version } }).pipe(timeout(15000));
  }
}
