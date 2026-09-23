import { Component, DestroyRef, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { ActivatedRoute, Router } from "@angular/router";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { finalize, timeout } from "rxjs";
import { API_BASE_URL } from "../../core/project-api.service";
import {
  AuthSessionService,
  LoginResponse,
} from "../services/auth-session.service";
import {
  loginValidation,
  safeReturnUrl,
} from "../../shared/validation/auth-validation";
import { apiError } from "../../core/api-error";
@Component({
  selector: "app-login-page",
  imports: [FormsModule],
  templateUrl: "./login-page.component.html",
  styleUrl: "./login-page.component.css",
})
export class LoginPageComponent {
  username = "";
  password = "";
  readonly busy = signal(false);
  readonly error = signal("");
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private readonly session = inject(AuthSessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  submit(): void {
    if (this.busy()) return;
    const validation = loginValidation(this.username, this.password);
    this.error.set(validation);
    if (validation) return;
    this.busy.set(true);
    const requestedAt = Date.now();
    this.http
      .post<LoginResponse>(`${this.base}/auth/login`, {
        username: this.username.trim(),
        password: this.password,
      })
      .pipe(
        timeout(15000),
        takeUntilDestroyed(this.destroy),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (response) => {
          try {
            this.session.start(response, requestedAt);
            this.password = "";
            void this.router.navigateByUrl(
              safeReturnUrl(this.route.snapshot.queryParamMap.get("returnUrl")),
              { replaceUrl: true },
            );
          } catch {
            this.error.set(
              "Unable to start your session. Please sign in again.",
            );
          }
        },
        error: (error) => {
          this.error.set(
            error instanceof HttpErrorResponse && error.status === 401
              ? "Incorrect username or password."
              : error.status === 429
                ? "Login is busy. Please try again shortly."
                : apiError(error).message,
          );
        },
      });
  }
}
