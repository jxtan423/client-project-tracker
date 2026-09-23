import { AuthSessionService } from "./auth/services/auth-session.service";
import { Component, inject } from "@angular/core";
import { RouterLink, RouterOutlet } from "@angular/router";
import { ToastService } from "./shared/toast.service";

@Component({
  selector: "app-root",
  imports: [RouterLink, RouterOutlet],
  templateUrl: "./app.html",
})
export class App {
  readonly auth = inject(AuthSessionService);
  readonly toasts = inject(ToastService);
}
