import { authGuard, guestGuard } from "./auth/guards/auth.guard";
import { Routes } from "@angular/router";

export const routes: Routes = [
  {
    path: "login",
    canActivate: [guestGuard],
    loadComponent: () =>
      import("./auth/pages/login-page.component").then(
        (m) => m.LoginPageComponent,
      ),
    title: "Sign in · Client Project Tracker",
  },
  {
    path: "projects",
    canActivate: [authGuard],
    loadComponent: () =>
      import("./projects/pages/projects-page.component").then(
        (m) => m.ProjectsPageComponent,
      ),
    title: "Projects · Client Project Tracker",
  },
  {
    path: "projects/:id/tasks",
    canActivate: [authGuard],
    loadComponent: () =>
      import("./tasks/pages/tasks-page.component").then(
        (m) => m.TasksPageComponent,
      ),
    title: "Tasks · Client Project Tracker",
  },
  { path: "", pathMatch: "full", redirectTo: "projects" },
  { path: "**", redirectTo: "projects" },
];
