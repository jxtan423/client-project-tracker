import { authInterceptor } from "./auth/interceptors/auth.interceptor";
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from "@angular/core";
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { provideRouter, withInMemoryScrolling } from "@angular/router";
import { routes } from "./app.routes";

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: "enabled" }),
    ),
  ],
};
