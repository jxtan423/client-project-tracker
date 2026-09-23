import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { AuthSessionService } from "../services/auth-session.service";

export const authGuard: CanActivateFn = (_route, state) =>
  inject(AuthSessionService).token()
    ? true
    : inject(Router).createUrlTree(["/login"], {
        queryParams: { returnUrl: state.url },
      });
export const guestGuard: CanActivateFn = () =>
  inject(AuthSessionService).token()
    ? inject(Router).createUrlTree(["/projects"])
    : true;
