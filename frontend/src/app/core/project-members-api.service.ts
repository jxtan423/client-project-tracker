import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { timeout } from 'rxjs';
import { API_BASE_URL } from './project-api.service';
import { AppUser } from './user.model';

@Injectable({ providedIn: 'root' })
export class ProjectMembersApiService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  listUsers() {
    return this.http.get<AppUser[]>(`${this.base}/users`).pipe(timeout(15000));
  }

  listMembers(projectId: number) {
    return this.http.get<AppUser[]>(`${this.base}/projects/${projectId}/members`).pipe(timeout(15000));
  }

  addMember(projectId: number, userId: number) {
    return this.http.post<AppUser>(`${this.base}/projects/${projectId}/members`, { userId }).pipe(timeout(15000));
  }

  removeMember(projectId: number, userId: number) {
    return this.http.delete<void>(`${this.base}/projects/${projectId}/members/${userId}`).pipe(timeout(15000));
  }
}
