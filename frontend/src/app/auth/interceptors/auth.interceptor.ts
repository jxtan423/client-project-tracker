import { inject } from "@angular/core";
import { HttpInterceptorFn } from "@angular/common/http";
import { catchError, throwError } from "rxjs";
import { API_BASE_URL } from "../../core/project-api.service";
import { AuthSessionService } from "../services/auth-session.service";
import { isApiUrl } from "../../shared/validation/auth-validation";

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const base = inject(API_BASE_URL);
  if (!isApiUrl(request.url, base)) return next(request);
  const url = new URL(request.url, base);
  const loginUrl = new URL(base.replace(/\/$/, "") + "/auth/login");
  if (url.pathname === loginUrl.pathname) return next(request);
  const session = inject(AuthSessionService);
  const token = session.token();
  const authorized = token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;
  return next(authorized).pipe(
    catchError((error) => {
      if (error.status === 401 && token) session.expire(token);
      return throwError(() => error);
    }),
  );
};
