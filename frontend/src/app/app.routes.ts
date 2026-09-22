import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: 'projects', loadComponent: () => import('./projects/pages/projects-page.component').then(m => m.ProjectsPageComponent), title: 'Projects · Client Project Tracker' },
  { path: 'projects/:id/tasks', loadComponent: () => import('./tasks/pages/tasks-page.component').then(m => m.TasksPageComponent), title: 'Tasks · Client Project Tracker' },
  { path: '', pathMatch: 'full', redirectTo: 'projects' },
  { path: '**', redirectTo: 'projects' },
];
