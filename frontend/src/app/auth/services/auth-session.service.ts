import { Injectable, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { ToastService } from "../../shared/toast.service";
export interface LoginResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: { id: number; name: string; username: string };
}
@Injectable({ providedIn: "root" })
export class AuthSessionService {
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly currentUser = signal<LoginResponse["user"] | null>(null);
  readonly user = this.currentUser.asReadonly();
  private accessToken: string | null = null;
  private expiresAt = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  start(response: LoginResponse, requestedAt: number): void {
    if (
      typeof response.accessToken !== "string" ||
      !response.accessToken ||
      response.tokenType !== "Bearer" ||
      !Number.isFinite(response.expiresIn) ||
      response.expiresIn <= 0 ||
      response.expiresIn > 86400 ||
      !response.user?.id
    )
      throw new Error("Invalid login response");
    this.clear();
    this.accessToken = response.accessToken;
    // Count from request start, conservatively allowing for network delay.
    this.expiresAt = requestedAt + response.expiresIn * 1000;
    if (this.expiresAt <= Date.now()) {
      this.clear();
      throw new Error("Login expired; please try again.");
    }
    this.currentUser.set(response.user);
    const token = this.accessToken;
    this.timer = setTimeout(
      () => this.expire(token),
      this.expiresAt - Date.now(),
    );
  }
  token(): string | null {
    if (this.accessToken && Date.now() >= this.expiresAt) {
      this.expire(this.accessToken);
      return null;
    }
    return this.accessToken;
  }
  expire(expectedToken: string): void {
    // A late 401 from an earlier session must not log out a newer session.
    if (this.accessToken !== expectedToken) return;
    const returnUrl = this.router.url;
    this.clear();
    this.toasts.error("Your session has ended. Please sign in again.");
    void this.router.navigate(["/login"], {
      queryParams: { returnUrl },
      replaceUrl: true,
    });
  }
  logout(): void {
    this.clear();
    this.toasts.messages.set([]);
    void this.router.navigate(["/login"], { replaceUrl: true });
  }
  private clear(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.accessToken = null;
    this.expiresAt = 0;
    this.currentUser.set(null);
  }
}
